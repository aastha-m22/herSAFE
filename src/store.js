/**
 * Persistence layer.
 *
 * Wraps localStorage with: a namespace, JSON (de)serialisation, a schema
 * version for future migrations, and a silent in-memory fallback for private
 * mode / storage-disabled environments. All access goes through here so no
 * other module ever touches localStorage directly.
 */

const NS = 'hersafe';
const VERSION = 1;

const memory = new Map();
let backend = 'local';

// Probe once: some browsers throw on access in private mode.
try {
  const probe = `${NS}:__probe`;
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
} catch {
  backend = 'memory';
}

const key = (k) => `${NS}:${k}`;

function readRaw(k) {
  if (backend === 'memory') return memory.get(k) ?? null;
  try { return localStorage.getItem(key(k)); } catch { return null; }
}

function writeRaw(k, v) {
  if (backend === 'memory') { memory.set(k, v); return; }
  try { localStorage.setItem(key(k), v); }
  catch { backend = 'memory'; memory.set(k, v); } // quota/denied -> degrade
}

export const store = {
  /** @returns backend in use, for diagnostics. */
  get backend() { return backend; },

  get(k, fallback = null) {
    const raw = readRaw(k);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },

  set(k, value) {
    try { writeRaw(k, JSON.stringify(value)); } catch { /* non-serialisable */ }
    return value;
  },

  remove(k) {
    if (backend === 'memory') memory.delete(k);
    else try { localStorage.removeItem(key(k)); } catch { /* ignore */ }
  },
};

/** Run one-time data migrations keyed on the stored schema version. */
export function migrate() {
  const v = store.get('__v', 0);
  if (v < VERSION) {
    // (future migrations slot in here, e.g. reshaping contacts)
    store.set('__v', VERSION);
  }
}
