/**
 * Emergency audio recording (feature F). On SOS, captures microphone audio via
 * MediaRecorder. When the recording stops it tries to upload to the optional
 * /api/upload endpoint; if that isn't configured it downloads locally so the
 * evidence is never lost. Returns a shareable URL when an upload succeeds.
 */
const UPLOAD_ENDPOINT = './api/upload';

export class Recorder {
  constructor() {
    this._rec = null;
    this._stream = null;
    this._chunks = [];
    this.supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  get active() { return this._rec?.state === 'recording'; }

  /** Begin recording. Resolves false if permission denied / unsupported. */
  async start() {
    if (!this.supported || this.active) return false;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._chunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      this._rec = new MediaRecorder(this._stream, mime ? { mimeType: mime } : undefined);
      this._rec.ondataavailable = (e) => { if (e.data.size) this._chunks.push(e.data); };
      this._rec.start();
      return true;
    } catch (err) {
      console.warn('[recorder] start failed', err);
      this._cleanup();
      return false;
    }
  }

  /**
   * Stop and persist. @returns {Promise<{url?:string, uploaded:boolean, blob:Blob}|null>}
   */
  async stop() {
    if (!this._rec) return null;
    const blob = await new Promise((resolve) => {
      this._rec.onstop = () => resolve(new Blob(this._chunks, { type: this._chunks[0]?.type || 'audio/webm' }));
      try { this._rec.stop(); } catch { resolve(new Blob(this._chunks)); }
    });
    this._cleanup();

    const uploaded = await this._upload(blob);
    if (uploaded) return { url: uploaded, uploaded: true, blob };
    const url = this._download(blob);
    return { url, uploaded: false, blob };
  }

  async _upload(blob) {
    try {
      const res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.url || null; // server returns { url } when storage is configured
    } catch { return null; }
  }

  _download(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hersafe-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null; // local file has no shareable URL
  }

  _cleanup() {
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
    this._rec = null;
  }
}
