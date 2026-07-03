/* ============================================================
   POST /api/upload  — optional evidence storage for feature F.

   Receives a raw audio body and, IF Vercel Blob is configured, stores it and
   returns a public { url }. If storage isn't set up it responds { ok:false }
   with 200 so the client cleanly falls back to a local download — the
   recording is never lost either way.

   To enable cloud storage:
     1) `npm i @vercel/blob`
     2) add a Blob store in the Vercel dashboard (sets BLOB_READ_WRITE_TOKEN)
   No secrets are ever sent to the browser.
   ============================================================ */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'POST only' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, message: 'Storage not configured — client will save locally.' });
  }

  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 25 * 1024 * 1024) return res.status(413).json({ ok: false, message: 'File too large' }); // 25 MB cap
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const { put } = await import('@vercel/blob');            // loaded only when configured
    const key = `hersafe/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
    const { url } = await put(key, buffer, { access: 'public', contentType: req.headers['content-type'] || 'audio/webm' });
    return res.status(200).json({ ok: true, url });
  } catch (err) {
    console.error('[upload] failed', err);
    return res.status(200).json({ ok: false, message: 'Upload failed — client will save locally.' });
  }
};

// Receive the raw audio body ourselves (no automatic parsing).
module.exports.config = { api: { bodyParser: false } };
