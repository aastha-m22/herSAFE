/**
 * Passive sensors: speech-phrase recognition and shake detection.
 * Each reports intent by calling the injected `onDetect(level, reason)` — it
 * does not touch the machine directly, keeping detection and control separate.
 */
import { State, TUNING } from '../config.js';

export class VoiceSensor {
  constructor(getSettings, onDetect, onError) {
    this.getSettings = getSettings;
    this.onDetect = onDetect;
    this.onError = onError;
    this.available = false;
    this._recog = null;
    this._wanted = false;
    this._init();
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this.available = true;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const phrase = (this.getSettings().phrase || '').toLowerCase().trim();
      if (phrase && transcript.toLowerCase().includes(phrase)) {
        this.onDetect('confirm', `you said “${this.getSettings().phrase}”`);
      }
    };
    recog.onend = () => { if (this._wanted && this._active()) { try { recog.start(); } catch { /* race */ } } };
    recog.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this._wanted = false;
        this.onError?.('Microphone blocked — voice activation is off.');
      }
    };
    this._recog = recog;
  }

  _active() { const s = this.getSettings(); return s.voice && s.armed; }

  start() { if (this._recog && this._active()) { this._wanted = true; try { this._recog.start(); } catch { /* already running */ } } }
  stop()  { this._wanted = false; try { this._recog?.stop(); } catch { /* not running */ } }
}

export class ShakeSensor {
  constructor(getSettings, getState, onDetect) {
    this.getSettings = getSettings;
    this.getState = getState;
    this.onDetect = onDetect;
    this.ready = false;
    this._peaks = [];
    this._lastMag = 0;
    this._onMotion = this._onMotion.bind(this);
    this._initIfNoPermission();
  }

  _initIfNoPermission() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    // Android/desktop: no explicit permission — attach now.
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      window.addEventListener('devicemotion', this._onMotion);
      this.ready = true;
    }
  }

  /** iOS 13+: must be called from a user gesture to prompt for motion access. */
  async requestPermission() {
    if (this.ready || typeof DeviceMotionEvent === 'undefined') return;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res === 'granted') { window.addEventListener('devicemotion', this._onMotion); this.ready = true; }
      } catch { /* denied */ }
    }
  }

  _onMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const jerk = Math.abs(mag - this._lastMag);
    this._lastMag = mag;

    const s = this.getSettings();
    if (!s.shake || !s.armed || jerk <= TUNING.shakeJerkThreshold) return;

    const now = Date.now();
    this._peaks.push(now);
    this._peaks = this._peaks.filter((t) => now - t < TUNING.shakeWindowMs);

    const st = this.getState();
    if (this._peaks.length >= TUNING.shakePeaksConfirm) {
      this._peaks = [];
      if (st === State.IDLE || st === State.ELEVATED) this.onDetect('confirm', 'a hard shake');
    } else if (this._peaks.length >= TUNING.shakePeaksElevate && st === State.IDLE) {
      this.onDetect('elevate', 'sudden movement');
    }
  }
}
