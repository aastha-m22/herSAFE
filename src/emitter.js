/**
 * Minimal event bus. Decouples the state machine and services from the UI:
 * modules publish facts ("state:change", "location:update") and the UI
 * subscribes, instead of everyone holding references to each other.
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn); // unsubscribe
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((fn) => {
        try { fn(payload); } catch (err) { console.error(`[emitter] ${type}`, err); }
      });
    },
  };
}
