/**
 * Settings sheet. Binds each control to the live settings object, persists on
 * change, and invokes side-effect callbacks (voice on/off, theme apply) without
 * knowing how they're implemented.
 */
import { $, $$ } from '../dom.js';
import { store } from '../store.js';
import { sanitizeText } from '../utils/util.js';
import { setTheme } from '../theme.js';
import { TUNING } from '../config.js';

export function mountSettings(settings, { onVoiceToggle } = {}) {
  const save = () => store.set('settings', settings);

  const bindToggle = (sel, key, after) => {
    const el = $(sel);
    el.addEventListener('click', () => {
      settings[key] = !settings[key];
      el.classList.toggle('on', settings[key]);
      el.setAttribute('aria-checked', String(settings[key]));
      save();
      after?.(settings[key]);
    });
  };

  bindToggle('#t-shake', 'shake');
  bindToggle('#t-voice', 'voice', (on) => onVoiceToggle?.(on));
  bindToggle('#t-siren', 'siren');
  bindToggle('#t-vibe', 'vibe');
  bindToggle('#t-autosend', 'autosend');
  bindToggle('#t-track', 'track');
  bindToggle('#t-record', 'record');
  bindToggle('#t-flashlight', 'flashlight');

  $('#s-phrase').addEventListener('change', (e) => {
    settings.phrase = sanitizeText(e.target.value, 40) || 'help me now';
    e.target.value = settings.phrase; save();
  });
  $('#s-webhook').addEventListener('change', (e) => { settings.webhook = e.target.value.trim(); save(); });

  $('#cd-minus').addEventListener('click', () => { settings.countdown = Math.max(TUNING.countdownMin, settings.countdown - 1); syncCountdown(settings); save(); });
  $('#cd-plus').addEventListener('click',  () => { settings.countdown = Math.min(TUNING.countdownMax, settings.countdown + 1); syncCountdown(settings); save(); });

  // theme segmented control
  $$('#theme-seg button').forEach((btn) => btn.addEventListener('click', () => {
    settings.theme = btn.dataset.theme;
    $$('#theme-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    setTheme(settings.theme);
    save();
  }));

  // fake-call config
  $('#fc-name').addEventListener('change', (e) => { settings.fakeCallName = sanitizeText(e.target.value, 30) || 'Mom'; e.target.value = settings.fakeCallName; save(); });
  $('#fc-minus').addEventListener('click', () => { settings.fakeCallDelay = Math.max(0, settings.fakeCallDelay - 1); syncFakeCall(settings); save(); });
  $('#fc-plus').addEventListener('click',  () => { settings.fakeCallDelay = Math.min(30, settings.fakeCallDelay + 1); syncFakeCall(settings); save(); });
  $$('#fc-ring button').forEach((btn) => btn.addEventListener('click', () => {
    settings.fakeCallRingtone = btn.dataset.ring;
    $$('#fc-ring button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    save();
  }));

  syncSettingsUI(settings);
}

function syncCountdown(settings) { $('#cd-val').textContent = `${settings.countdown}s`; }
function syncFakeCall(settings) { $('#fc-delay-val').textContent = `${settings.fakeCallDelay}s`; }

/** Reflect current settings into the controls (called on open). */
export function syncSettingsUI(settings) {
  $('#s-phrase').value = settings.phrase;
  $('#s-webhook').value = settings.webhook || '';
  $('#fc-name').value = settings.fakeCallName || '';
  syncCountdown(settings);
  syncFakeCall(settings);
  [['#t-shake', settings.shake], ['#t-voice', settings.voice], ['#t-siren', settings.siren], ['#t-vibe', settings.vibe],
   ['#t-autosend', settings.autosend], ['#t-track', settings.track], ['#t-record', settings.record], ['#t-flashlight', settings.flashlight]]
    .forEach(([sel, on]) => { const el = $(sel); if (!el) return; el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); });
  $$('#theme-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === settings.theme)));
  $$('#fc-ring button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ring === settings.fakeCallRingtone)));
}
