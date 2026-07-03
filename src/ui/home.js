/**
 * Home view. Subscribes to the machine's events and renders the status
 * (eyebrow / headline / sub / pill / dots / countdown ring) plus the primary
 * "Hold for help" control and the arm switch. All interaction funnels back
 * into the machine via transitions — the view never mutates state directly.
 */
import { $ } from '../dom.js';
import { State, STATE_COPY, TUNING } from '../config.js';
import { haptic } from '../utils/util.js';
import { toast } from './toast.js';

export function mountHome(ctx) {
  const { machine, settings, bus, unlock } = ctx;
  const el = {
    eyebrow: $('#eyebrow'), word: $('#word'), sub: $('#sub'), dots: $('#dots'),
    countdown: $('#countdown'), cdNum: $('#cd-num'), cdRing: $('#cd-ring'),
    pill: $('#pill'), pillTxt: $('#pill-txt'),
    help: $('#help'), helpFill: $('#help-fill'), helpT: $('#help-t'), helpH: $('#help-h'),
    armRow: $('#armrow'), armB: $('#arm-b'), armS: $('#arm-s'), armSwitch: $('#arm-switch'),
  };

  const CIRC = 2 * Math.PI * Number(el.cdRing.getAttribute('r')); // ring circumference
  el.cdRing.style.strokeDasharray = String(CIRC);

  /* ---- render on every state change ---- */
  bus.on('state:change', ({ next, reason }) => {
    const armed = settings.armed;
    const copy = next === State.IDLE ? (armed ? STATE_COPY[State.IDLE].armed : STATE_COPY[State.IDLE].off) : STATE_COPY[next];
    const sub = typeof copy.sub === 'function' ? copy.sub(reason) : copy.sub;

    el.eyebrow.textContent = copy.eye;
    el.word.textContent = copy.word;
    el.sub.textContent = sub;
    el.sub.style.display = sub ? '' : 'none';

    el.dots.classList.toggle('hidden', !(next === State.IDLE && armed));
    el.countdown.hidden = next !== State.CONFIRMING;

    // pill
    el.pill.classList.toggle('off', next === State.IDLE && !armed);
    el.pillTxt.textContent =
      next === State.IDLE ? (armed ? 'Protected' : 'Off') :
      next === State.ELEVATED ? 'On alert' :
      next === State.CONFIRMING ? 'Sending' : 'SOS';

    // help button affordance
    el.help.classList.toggle('cancel', next === State.CONFIRMING);
    if (next === State.CONFIRMING) { el.helpT.textContent = 'Tap to cancel'; el.helpH.textContent = 'False alarm? Stop the alert'; }
    else if (next === State.ELEVATED) { el.helpT.textContent = 'Tap if you need help'; el.helpH.textContent = 'Sends an alert to your circle'; }
    else if (next === State.IDLE) { resetHelp(); }

    if (next === State.IDLE) renderArm();
  });

  bus.on('state:countdown', ({ left, total }) => {
    el.cdNum.textContent = String(left);
    el.cdRing.style.strokeDashoffset = String(CIRC * (1 - left / total));
  });

  /* ---- help button: hold to trigger / tap to cancel or escalate ---- */
  let holdTimer = null;
  const resetHelp = () => {
    el.help.classList.remove('cancel');
    el.helpFill.style.width = '0';
    el.helpT.textContent = 'Hold for help';
    el.helpH.textContent = 'Press and hold, or say your phrase';
  };
  const onDown = (e) => {
    e.preventDefault();
    unlock();
    if (machine.is(State.CONFIRMING)) { machine.cancel('cancelled by you'); toast('Alert cancelled'); return; }
    if (machine.is(State.ELEVATED))   { machine.to(State.CONFIRMING, 'you tapped for help'); return; }
    if (machine.is(State.TRIGGERED))  return;
    let frac = 0;
    const step = 1 / (TUNING.holdMs / 40);
    holdTimer = setInterval(() => {
      frac += step;
      el.helpFill.style.width = `${Math.min(100, frac * 100)}%`;
      el.helpH.textContent = 'Keep holding…';
      if (frac >= 1) { clearInterval(holdTimer); machine.to(State.CONFIRMING, 'you held for help'); }
    }, 40);
  };
  const onUp = () => {
    clearInterval(holdTimer);
    if (machine.is(State.IDLE)) { el.helpFill.style.width = '0'; el.helpH.textContent = 'Press and hold, or say your phrase'; }
  };
  el.help.addEventListener('pointerdown', onDown);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.help.addEventListener(ev, onUp));

  /* ---- arm / disarm ---- */
  const renderArm = () => {
    el.armSwitch.classList.toggle('on', settings.armed);
    el.armSwitch.setAttribute('aria-checked', String(settings.armed));
    el.armB.textContent = settings.armed ? 'Protection on' : 'Protection off';
    el.armS.textContent = settings.armed ? 'Always watching, quietly' : 'Tap to start watching';
  };
  el.armSwitch.addEventListener('click', () => {
    settings.armed = !settings.armed;
    ctx.persistSettings();
    renderArm();
    if (settings.armed) { unlock(); ctx.startVoice(); toast('Protection on', 'ok'); }
    else { ctx.stopVoice(); toast('Protection off'); }
    machine.to(State.IDLE, settings.armed ? 'armed' : 'disarmed');
    // force re-render of idle copy even if already idle
    bus.emit('state:change', { next: State.IDLE, prev: State.IDLE, reason: '', settings });
  });

  renderArm();
  return { resetHelp };
}
