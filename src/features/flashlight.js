/**
 * Flashlight SOS (feature G). Blinks the rear camera torch while an emergency
 * is active, on devices that expose the `torch` capability (Android Chrome).
 * Feature-detects and no-ops silently elsewhere (e.g. iOS Safari).
 */
import { TUNING } from '../config.js';

export class Flashlight {
  constructor() {
    this._stream = null;
    this._track = null;
    this._timer = null;
    this._on = false;
    this.supported = !!navigator.mediaDevices?.getUserMedia;
  }

  get active() { return this._timer !== null; }

  /** Acquire the torch track and start blinking. Returns false if unsupported. */
  async start() {
    if (!this.supported || this.active) return false;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this._track = this._stream.getVideoTracks()[0];
      const caps = this._track.getCapabilities?.() || {};
      if (!caps.torch) { this._cleanup(); return false; } // no torch on this device
      this._blink();
      return true;
    } catch (err) {
      console.warn('[flashlight] unavailable', err);
      this._cleanup();
      return false;
    }
  }

  async stop() {
    clearInterval(this._timer);
    this._timer = null;
    await this._set(false).catch(() => {});
    this._cleanup();
  }

  _blink() {
    this._timer = setInterval(async () => {
      this._on = !this._on;
      await this._set(this._on).catch(() => {});
    }, TUNING.flashBlinkMs);
  }

  _set(on) { return this._track?.applyConstraints({ advanced: [{ torch: on }] }); }

  _cleanup() {
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
    this._track = null;
    this._on = false;
  }
}
