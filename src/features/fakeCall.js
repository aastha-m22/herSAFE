/**
 * Fake incoming call (feature C). A believable full-screen call screen the user
 * can trigger to create an exit from an uncomfortable situation. Caller name,
 * delay, and ringtone are configurable. Ringtones are synthesized with Web
 * Audio so there are no audio assets to ship.
 */

const RINGTONES = {
  classic:  { pattern: [[880, 0], [988, 0.4]], loop: 2.0, gap: 0.4 },
  marimba:  { pattern: [[1047, 0], [1319, 0.18], [1568, 0.36]], loop: 1.2, gap: 0.5 },
  oldphone: { pattern: [[480, 0], [620, 0.5]], loop: 2.0, gap: 1.0 },
};

export class FakeCall {
  constructor(getSettings) {
    this.getSettings = getSettings;
    this._ctx = null;
    this._ringTimer = null;
    this._delayTimer = null;
    this._vibeTimer = null;
    this._els = null;
  }

  /** Schedule the call after the configured delay. */
  schedule() {
    const s = this.getSettings();
    this._teardown();
    const delayMs = Math.max(0, Number(s.fakeCallDelay) || 0) * 1000;
    this._delayTimer = setTimeout(() => this._ring(), delayMs);
    return delayMs;
  }

  cancel() { this._teardown(); this._hide(); }

  _ring() {
    const s = this.getSettings();
    this._show(s.fakeCallName || 'Unknown');
    this._startRingtone(s.fakeCallRingtone);
    if ('vibrate' in navigator) {
      const buzz = () => { try { navigator.vibrate([600, 400]); } catch {} };
      buzz();
      this._vibeTimer = setInterval(buzz, 1200);
    }
  }

  /* ---- UI ---- */
  _show(name) {
    let overlay = document.getElementById('fakecall');
    if (!overlay) { overlay = this._build(); document.body.append(overlay); }
    overlay.querySelector('.fc-name').textContent = name;
    overlay.querySelector('.fc-sub').textContent = 'mobile';
    overlay.querySelector('.fc-avatar').textContent = (name[0] || '?').toUpperCase();
    overlay.hidden = false;
    overlay.dataset.state = 'ringing';
  }

  _build() {
    const html = `
      <div class="fc-inner">
        <div class="fc-top">
          <div class="fc-avatar"></div>
          <div class="fc-name"></div>
          <div class="fc-sub">mobile</div>
        </div>
        <div class="fc-actions">
          <button class="fc-btn decline" aria-label="Decline call">
            <svg viewBox="0 0 24 24"><path d="M16 8l-8 8M8 8l8 8"/></svg>
          </button>
          <button class="fc-btn accept" aria-label="Accept call">
            <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
          </button>
        </div>
      </div>`;
    const overlay = document.createElement('div');
    overlay.className = 'fakecall'; overlay.id = 'fakecall'; overlay.hidden = true;
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-label', 'Incoming call');
    overlay.innerHTML = html;
    overlay.querySelector('.decline').addEventListener('click', () => this.cancel());
    overlay.querySelector('.accept').addEventListener('click', () => this._answer(overlay));
    this._els = overlay;
    return overlay;
  }

  _answer(overlay) {
    this._stopRingtone();
    clearInterval(this._vibeTimer);
    overlay.dataset.state = 'active';
    overlay.querySelector('.fc-sub').textContent = 'Connected';
    let sec = 0;
    const sub = overlay.querySelector('.fc-sub');
    this._callTimer = setInterval(() => {
      sec += 1;
      sub.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }, 1000);
    // tapping anywhere ends the "call"
    overlay.querySelector('.decline').setAttribute('aria-label', 'End call');
  }

  _hide() {
    const o = document.getElementById('fakecall');
    if (o) o.hidden = true;
    clearInterval(this._callTimer);
  }

  /* ---- ringtone synthesis ---- */
  _startRingtone(name) {
    const tone = RINGTONES[name] || RINGTONES.classic;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._ctx;
      const playCycle = () => {
        tone.pattern.forEach(([freq, at]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.value = freq;
          const t0 = ctx.currentTime + at;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0); osc.stop(t0 + 0.34);
        });
      };
      playCycle();
      this._ringTimer = setInterval(playCycle, (tone.loop + tone.gap) * 1000);
    } catch (err) { console.warn('[fakeCall] ringtone failed', err); }
  }

  _stopRingtone() {
    clearInterval(this._ringTimer);
    try { this._ctx?.close(); } catch {}
    this._ctx = null;
  }

  _teardown() {
    clearTimeout(this._delayTimer);
    clearInterval(this._vibeTimer);
    this._stopRingtone();
    try { navigator.vibrate?.(0); } catch {}
  }
}

export { RINGTONES };
