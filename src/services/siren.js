/**
 * Emergency siren via Web Audio (a frequency-modulated sawtooth). Encapsulates
 * the AudioContext so callers just toggle on/off; safe to call repeatedly.
 */
export class Siren {
  constructor() { this._ctx = null; this._osc = null; this._lfo = null; }

  /** Resume a suspended context — must run inside a user gesture on iOS. */
  unlock() { if (this._ctx?.state === 'suspended') this._ctx.resume(); }

  start() {
    try {
      this._ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      this.unlock();
      const ctx = this._ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth'; osc.frequency.value = 720;
      lfo.type = 'sine'; lfo.frequency.value = 4.5; lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0.1;
      osc.connect(gain).connect(ctx.destination);
      osc.start(); lfo.start();
      this._osc = osc; this._lfo = lfo;
    } catch (err) { console.warn('[siren] start failed', err); }
  }

  stop() {
    try { this._osc?.stop(); this._lfo?.stop(); } catch { /* already stopped */ }
    this._osc = this._lfo = null;
  }
}
