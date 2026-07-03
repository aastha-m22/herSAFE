/**
 * Application configuration: enums, defaults, endpoints, and UI copy.
 * Centralising these removes magic strings/numbers scattered across modules.
 */

/** Finite states of the detection engine. */
export const State = Object.freeze({
  IDLE: 'idle',
  ELEVATED: 'elevated',
  CONFIRMING: 'confirming',
  TRIGGERED: 'triggered',
});

export const ALERT_ENDPOINT = './api/alert';

/** Persisted-settings shape + defaults (merged over stored values). */
export const DEFAULT_SETTINGS = Object.freeze({
  phrase: 'help me now',
  countdown: 8,
  shake: true,
  voice: true,
  siren: true,
  vibe: true,
  armed: true,
  autosend: true,
  webhook: '',
  theme: 'system',          // 'system' | 'light' | 'dark'
  // ---- feature toggles ----
  track: true,              // A: live location updates during emergency
  record: false,            // F: record audio on SOS (off by default — privacy)
  flashlight: true,         // G: blink torch during emergency (if supported)
  // ---- fake call (C) ----
  fakeCallName: 'Mom',
  fakeCallDelay: 5,         // seconds before it "rings"
  fakeCallRingtone: 'classic', // 'classic' | 'marimba' | 'oldphone'
});

/** Tunables for the sensors / timers (documented, not magic). */
export const TUNING = Object.freeze({
  elevatedTimeoutMs: 20_000,   // auto de-escalate after this quiet window
  shakeJerkThreshold: 14,      // m/s^2 delta that counts as a jolt
  shakeWindowMs: 1_600,        // peaks within this window form a "shake"
  shakePeaksElevate: 2,        // peaks -> elevated
  shakePeaksConfirm: 4,        // peaks -> confirming
  holdMs: 1_120,               // press-and-hold duration to trigger
  geoTimeoutMs: 8_000,
  countdownMin: 3,
  countdownMax: 20,
  logCap: 60,
  trackIntervalMs: 15_000,  // A: live-tracking re-fix cadence
  flashBlinkMs: 480,        // G: torch blink half-period
  incidentCap: 25,          // H: emergency history length
});

/** Copy for each state, kept out of logic so it's easy to tweak / localise. */
export const STATE_COPY = Object.freeze({
  [State.IDLE]: {
    armed:   { eye: 'Watching over you', word: "You're protected.", sub: 'Listening for your phrase and watching for sudden movement. Nothing for you to do.' },
    off:     { eye: 'Protection off',    word: 'Paused.',           sub: "herSAFE isn't watching right now. Turn protection on when you head out." },
  },
  [State.ELEVATED]:   { eye: "Something's off", word: 'Are you okay?',      sub: (r) => `I noticed ${r || 'sudden movement'}. Tap below if you need help — I'll stand down on my own if not.` },
  [State.CONFIRMING]: { eye: 'Calling for help', word: 'Sending alert…',    sub: '' },
  [State.TRIGGERED]:  { eye: 'Help requested',   word: 'Help is on the way.', sub: 'Your trusted circle has your location.' },
});
