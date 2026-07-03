/**
 * Safety timer (feature D). "I should be home in 30 minutes." If it expires
 * without the user confirming they're safe, it escalates to the emergency flow.
 * The active timer is persisted so it survives a reload / accidental refresh.
 */
import { store } from '../store.js';

export class SafetyTimer {
  constructor({ onTick, onExpire }) {
    this.onTick = onTick;
    this.onExpire = onExpire;
    this._interval = null;
    this.endsAt = null;
  }

  /** Resume a timer that was running before a reload, if still in the future. */
  restore() {
    const endsAt = store.get('timerEndsAt', null);
    if (endsAt && endsAt > Date.now()) { this.endsAt = endsAt; this._run(); return true; }
    if (endsAt) store.remove('timerEndsAt');
    return false;
  }

  start(minutes) {
    this.endsAt = Date.now() + minutes * 60_000;
    store.set('timerEndsAt', this.endsAt);
    this._run();
  }

  extend(minutes) {
    if (!this.isActive) return;
    this.endsAt += minutes * 60_000;
    store.set('timerEndsAt', this.endsAt);
    this.onTick?.(this.remaining);
  }

  cancel() {
    clearInterval(this._interval);
    this._interval = null;
    this.endsAt = null;
    store.remove('timerEndsAt');
  }

  get isActive() { return this._interval !== null; }
  get remaining() { return Math.max(0, (this.endsAt ?? 0) - Date.now()); }

  _run() {
    clearInterval(this._interval);
    this.onTick?.(this.remaining);
    this._interval = setInterval(() => {
      const left = this.remaining;
      this.onTick?.(left);
      if (left <= 0) {
        this.cancel();
        this.onExpire?.();
      }
    }, 1000);
  }
}

/** mm:ss formatter for the countdown label. */
export function formatRemaining(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
