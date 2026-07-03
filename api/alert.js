/* ============================================================
   POST /api/alert
   Fans a herSAFE alert out to every channel that's configured
   via environment variables (plus an optional per-request webhook).
   No npm dependencies — uses Node 18+ global fetch.

   Configure any subset of these in Vercel → Project → Settings →
   Environment Variables:

     TWILIO_ACCOUNT_SID   TWILIO_AUTH_TOKEN   TWILIO_FROM   (real SMS)
     ALERT_WEBHOOK_URL    (ntfy.sh topic URL, Discord webhook, or custom JSON sink)
     RESEND_API_KEY       ALERT_EMAIL_TO      (email via resend.com)
   ============================================================ */

module.exports = async (req, res) => {
  // CORS (harmless; lets the static app live on another origin if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // ---- validate & clamp all inputs (never trust the client) ----
  const message = String(body.message || 'herSAFE alert — I need help.').slice(0, 1500);
  const kind = ['alert', 'track', 'update', 'checkin'].includes(body.kind) ? body.kind : 'alert';
  const contacts = (Array.isArray(body.contacts) ? body.contacts : [])
    .slice(0, 20)
    .map((c) => ({ name: String(c?.name || '').slice(0, 60), phone: String(c?.phone || '').replace(/[^\d+]/g, '').slice(0, 16) }))
    .filter((c) => c.phone);
  const mapsUrl = /^https:\/\//.test(body.mapsUrl || '') ? String(body.mapsUrl).slice(0, 300) : '';
  const isHttpUrl = (u) => { try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; } };
  const clientWebhook = typeof body.webhook === 'string' && isHttpUrl(body.webhook.trim()) ? body.webhook.trim() : '';

  const channels = [];

  /* ---------------- Twilio SMS ---------------- */
  // Live-tracking refreshes go over webhook/email only — never repeat paid SMS.
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (sid && token && from && kind !== 'track' && kind !== 'update') {
    const numbers = contacts.map(c => (c.phone || '').replace(/[^\d+]/g, '')).filter(Boolean);
    if (numbers.length) {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      let sent = 0, failed = 0;
      for (const to of numbers) {
        try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ To: to, From: from, Body: message })
          });
          r.ok ? sent++ : failed++;
        } catch (e) { failed++; }
      }
      channels.push({ name: 'SMS', ok: sent > 0, detail: `${sent} sent${failed ? `, ${failed} failed` : ''}` });
    } else {
      channels.push({ name: 'SMS', ok: false, detail: 'no contact numbers' });
    }
  }

  /* ---------------- Webhook (env + per-request) ---------------- */
  const webhooks = [process.env.ALERT_WEBHOOK_URL, clientWebhook].filter(Boolean);
  for (const url of webhooks) {
    try {
      let opts;
      if (url.includes('discord.com/api/webhooks') || url.includes('discordapp.com/api/webhooks')) {
        opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }) };
      } else if (url.includes('ntfy.sh') || url.includes('/ntfy')) {
        opts = { method: 'POST', headers: { Title: 'herSAFE emergency', Priority: 'urgent', Tags: 'rotating_light,sos' }, body: message };
      } else {
        opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, mapsUrl, contacts, at: body.timestamp || new Date().toISOString() }) };
      }
      const r = await fetch(url, opts);
      channels.push({ name: 'Webhook', ok: r.ok, detail: r.ok ? 'delivered' : `http ${r.status}` });
    } catch (e) {
      channels.push({ name: 'Webhook', ok: false, detail: 'unreachable' });
    }
  }

  /* ---------------- Email (Resend) ---------------- */
  const { RESEND_API_KEY: rkey, ALERT_EMAIL_TO: eto, ALERT_EMAIL_FROM: efrom } = process.env;
  if (rkey && eto) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rkey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: efrom || 'herSAFE <onboarding@resend.dev>',
          to: eto.split(',').map(s => s.trim()),
          subject: 'herSAFE emergency alert',
          text: message + (mapsUrl ? `\n\nMap: ${mapsUrl}` : '')
        })
      });
      channels.push({ name: 'Email', ok: r.ok, detail: r.ok ? 'sent' : `http ${r.status}` });
    } catch (e) {
      channels.push({ name: 'Email', ok: false, detail: 'failed' });
    }
  }

  const anySent = channels.some(c => c.ok);
  return res.status(200).json({
    ok: true,
    anySent,
    channels,
    message: channels.length
      ? (anySent ? 'Alert dispatched.' : 'Channels configured but all failed.')
      : 'No alert channel configured yet — set env vars or a webhook in Settings.'
  });
};
