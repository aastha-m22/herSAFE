/**
 * Alert dispatch. Builds message payloads and delivers them over the network
 * (serverless /api/alert), returning a structured result the UI renders. Also
 * provides manual fallbacks (SMS deep-link, Web Share, clipboard) so a network
 * failure never leaves the user without a way to reach their people.
 */
import { ALERT_ENDPOINT } from '../config.js';
import { lastFix, mapsUrl } from './location.js';

/** Primary SOS message. Optional recording link appended when available (F). */
export function alertMessage(recordingUrl = '') {
  const url = mapsUrl();
  return [
    'herSAFE alert — I need help.',
    new Date().toLocaleString(),
    url ? `My location: ${url}` : 'Location unavailable',
    recordingUrl ? `Audio: ${recordingUrl}` : null,
    '(sent automatically by herSAFE)',
  ].filter(Boolean).join('\n');
}

/** Reassurance message for a safe check-in (E). */
export function checkInMessage() {
  const url = mapsUrl();
  return [
    "herSAFE check-in — I'm safe.",
    new Date().toLocaleString(),
    url ? `I'm here: ${url}` : null,
  ].filter(Boolean).join('\n');
}

/** Live-location update during an active emergency (A). */
export function updateMessage(fix) {
  return [
    'herSAFE — updated location',
    new Date().toLocaleTimeString(),
    mapsUrl(fix) || 'Location unavailable',
  ].join('\n');
}

/**
 * POST a message to the serverless function.
 * @returns {Promise<{ok:boolean, anySent:boolean, summary:string, channels?:any[]}>}
 */
export async function post({ kind, message, contacts, webhook }) {
  const fix = lastFix();
  try {
    const res = await fetch(ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        message,
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
        mapsUrl: mapsUrl(),
        timestamp: new Date().toISOString(),
        contacts,
        webhook: webhook || undefined,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.anySent) {
      const via = data.channels.filter((c) => c.ok).map((c) => c.name).join(' + ');
      return { ok: true, anySent: true, summary: `Sent automatically via ${via}`, channels: data.channels };
    }
    return { ok: true, anySent: false, summary: data.message || 'No channel set up — use the buttons below.' };
  } catch (err) {
    console.warn('[dispatch] network send failed', err);
    return { ok: false, anySent: false, summary: "Couldn't auto-send — use the buttons below." };
  }
}

export const sendAlert   = (opts) => post({ kind: 'alert',    message: alertMessage(opts?.recordingUrl), ...opts });
export const sendCheckIn = (opts) => post({ kind: 'checkin',  message: checkInMessage(), ...opts });
export const sendUpdate  = (opts) => post({ kind: 'update',   message: updateMessage(opts.fix), ...opts });

/* ---------- manual fallbacks ---------- */

export function smsHref(contacts, message = alertMessage()) {
  const numbers = contacts.map((c) => c.phone.replace(/[^\d+]/g, '')).filter(Boolean).join(',');
  const sep = /iPhone|iPad|Macintosh/.test(navigator.userAgent) ? '&' : '?';
  return `sms:${numbers}${sep}body=${encodeURIComponent(message)}`;
}

export async function shareAlert(message = alertMessage()) {
  if (navigator.share) {
    try { await navigator.share({ title: 'herSAFE', text: message }); return 'shared'; }
    catch { return 'cancelled'; }
  }
  await copyText(message);
  return 'copied';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
}
