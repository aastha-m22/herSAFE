/**
 * Composition root. Instantiates the machine and services, wires cross-cutting
 * side effects (siren, haptics, logging, body state attribute), mounts the UI
 * modules, and boots — gated behind onboarding on first run.
 *
 * Nothing here contains business logic; it's the wiring diagram.
 */
import { State, DEFAULT_SETTINGS } from './config.js';
import { store, migrate } from './store.js';
import { createEmitter } from './emitter.js';
import { SafetyMachine } from './state.js';
import { initTheme, setTheme, currentScheme } from './theme.js';
import { haptic } from './utils/util.js';

import { Siren } from './services/siren.js';
import { VoiceSensor, ShakeSensor } from './services/sensors.js';

import { FakeCall } from './features/fakeCall.js';
import { SafetyTimer } from './features/safetyTimer.js';
import { Recorder } from './features/recorder.js';
import { Flashlight } from './features/flashlight.js';

import { initSheets, openSheet } from './ui/sheets.js';
import { toast } from './ui/toast.js';
import { mountLog, addLog, mountHistory } from './ui/log.js';
import { mountContacts } from './ui/contacts.js';
import { mountSettings, syncSettingsUI } from './ui/settings.js';
import { mountHome } from './ui/home.js';
import { mountEmergency } from './ui/emergency.js';
import { mountTools } from './ui/tools.js';
import { maybeOnboard } from './ui/onboarding.js';
import { $ } from './dom.js';

/* ---------- state & singletons ---------- */
migrate();
const settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
const persistSettings = () => store.set('settings', settings);
const getSettings = () => settings;

initTheme(settings.theme);

const bus = createEmitter();
const machine = new SafetyMachine(bus, getSettings);
const siren = new Siren();

const voice = new VoiceSensor(getSettings, (_level, reason) => machine.to(State.CONFIRMING, reason), (msg) => setNote(msg, true));
const shake = new ShakeSensor(getSettings, () => machine.value, (level, reason) =>
  machine.to(level === 'confirm' ? State.CONFIRMING : State.ELEVATED, reason));

// feature singletons
const fakeCall = new FakeCall(getSettings);
const recorder = new Recorder();
const flashlight = new Flashlight();
const safetyTimer = new SafetyTimer({
  onTick: (ms) => bus.emit('timer:tick', ms),
  onExpire: () => { bus.emit('timer:done'); machine.to(State.CONFIRMING, 'safety timer expired'); },
});

/** Unlock gesture-gated APIs (iOS motion, audio, mic). Call from user input. */
function unlock() {
  shake.requestPermission();
  siren.unlock();
  if (settings.armed && settings.voice) voice.start();
}

/* ---------- cross-cutting side effects (single source of truth) ---------- */
bus.on('state:change', ({ next, reason }) => {
  document.body.setAttribute('data-state', next);
  switch (next) {
    case State.IDLE: siren.stop(); break;
    case State.ELEVATED: haptic([40], settings.vibe); addLog(`Elevated — ${reason || 'sensitivity raised'}`); break;
    case State.CONFIRMING: haptic([60, 40, 60], settings.vibe); addLog(`Confirming — ${reason || 'trigger detected'}`); break;
    case State.TRIGGERED:
      haptic([200, 80, 200, 80, 400], settings.vibe);
      if (settings.siren) siren.start();
      addLog('TRIGGERED — alert dispatched', { alarm: true });
      break;
  }
});
bus.on('state:standdown', () => addLog('Stood down — marked safe'));

/* ---------- mount UI ---------- */
initSheets();
mountLog($('#log'));
mountContacts({ list: $('#contact-list'), badges: [$('#cbadge')] });
mountSettings(settings, { onVoiceToggle: (on) => (on ? voice.start() : voice.stop()) });
mountHome({ machine, settings, bus, unlock, persistSettings, startVoice: () => voice.start(), stopVoice: () => voice.stop() });
mountHistory($('#history-list'));
mountEmergency({ machine, settings, bus, features: { recorder, flashlight } });
mountTools({ settings, bus, fakeCall, safetyTimer });

$('#open-contacts').addEventListener('click', () => openSheet('sheet-contacts'));
$('#open-history').addEventListener('click', () => openSheet('sheet-history'));
$('#open-settings').addEventListener('click', () => { syncSettingsUI(settings); openSheet('sheet-settings'); });

// quick theme toggle in the top bar (kept in sync with the settings control)
$('#theme-toggle').addEventListener('click', () => {
  settings.theme = currentScheme(settings.theme) === 'dark' ? 'light' : 'dark';
  setTheme(settings.theme);
  persistSettings();
  syncSettingsUI(settings);
});

/* ---------- boot note ---------- */
function setNote(msg, warn = false) {
  const note = $('#note');
  note.textContent = msg || '';
  note.classList.toggle('warn', warn);
}
function bootNote() {
  if (!window.isSecureContext) setNote('Open over https to enable voice and location.', true);
  else if (!voice.available) setNote('Voice activation needs Chrome or Safari.');
  else setNote('Tip: tap once to allow the mic and motion sensors.');
}

/* ---------- go ---------- */
function start() {
  document.getElementById('app').hidden = false;
  document.body.setAttribute('data-state', State.IDLE);
  bus.emit('state:change', { next: State.IDLE, prev: State.IDLE, reason: '', settings }); // initial render
  bootNote();
  addLog('herSAFE ready');
  if (settings.armed && settings.voice) voice.start();
  safetyTimer.restore();     // resume a timer that outlived a refresh
}

maybeOnboard(start);

// service worker (progressive enhancement)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// dev/testing handle
window.herSAFE = { machine, State, settings, fakeCall, safetyTimer, recorder, flashlight };
