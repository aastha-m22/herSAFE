/**
 * The detection engine, modelled as an explicit finite state machine.
 *
 * idle ─▶ elevated ─▶ confirming ─▶ triggered
 *   ▲________________________________│  (cancel / mark safe)
 *
 * The machine owns *only* transition rules and timers. It knows nothing about
 * the DOM — it emits events ('change', 'countdown', 'trigger', 'standdown')
 * that the UI and services react to. This inversion is what makes the code
 * testable and the features in later phases easy to bolt on.
 */
import { State, TUNING } from './config.js';

export class SafetyMachine {
  /**
   * @param {{emit:Function,on:Function}} bus  event emitter
   * @param {() => object} getSettings          returns live settings object
   */
  constructor(bus, getSettings) {
    this.bus = bus;
    this.getSettings = getSettings;
    this.state = State.IDLE;
    this._elevatedTimer = null;
    this._cdTimer = null;
    this._cdLeft = 0;
  }

  is(s) { return this.state === s; }
  get value() { return this.state; }

  /** Attempt a transition. Guards enforce legal moves; UI reacts via events. */
  to(next, reason = '') {
    const s = this.getSettings();
    if (next === this.state) return;
    if (next === State.ELEVATED && !s.armed) return; // no passive escalation while off

    const prev = this.state;
    this.state = next;
    clearTimeout(this._elevatedTimer);
    clearInterval(this._cdTimer);

    this.bus.emit('state:change', { prev, next, reason, settings: s });

    if (next === State.ELEVATED) {
      this._elevatedTimer = setTimeout(
        () => { if (this.is(State.ELEVATED)) this.to(State.IDLE, 'calm restored'); },
        TUNING.elevatedTimeoutMs,
      );
    }

    if (next === State.CONFIRMING) this._startCountdown(reason, s.countdown);
    if (next === State.TRIGGERED) this.bus.emit('state:trigger', { reason });
    if (next === State.IDLE && prev === State.TRIGGERED) this.bus.emit('state:standdown', { prev });
  }

  _startCountdown(reason, seconds) {
    this._cdLeft = seconds;
    const tick = () => {
      this.bus.emit('state:countdown', { left: this._cdLeft, total: seconds });
      if (this._cdLeft <= 0) {
        clearInterval(this._cdTimer);
        this.to(State.TRIGGERED, reason);
        return;
      }
      this._cdLeft -= 1;
    };
    tick();
    this._cdTimer = setInterval(tick, 1000);
  }

  /** Cancel any in-flight countdown/emergency and return to idle. */
  cancel(reason = 'cancelled') { this.to(State.IDLE, reason); }
}
