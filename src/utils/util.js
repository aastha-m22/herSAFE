/**
 * Small, pure utilities. Kept dependency-free and individually testable.
 */

/** Strip to a dialable string (digits and a single leading +). */
export function normalizePhone(input) {
  const cleaned = String(input).replace(/[^\d+]/g, '');
  return cleaned.startsWith('+')
    ? '+' + cleaned.slice(1).replace(/\+/g, '')
    : cleaned.replace(/\+/g, '');
}

/**
 * Loose E.164-friendly validation: optional +, 7–15 digits. Deliberately
 * permissive (numbers vary worldwide) while rejecting obvious junk.
 */
export function isValidPhone(input) {
  const n = normalizePhone(input);
  return /^\+?\d{7,15}$/.test(n);
}

/** Collapse whitespace and cap length; strips control chars. */
export function sanitizeText(input, max = 80) {
  return String(input).replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** HH:MM:SS for log timestamps. */
export function clockTime(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

/** Vibrate if allowed and supported; never throws. */
export function haptic(pattern, enabled = true) {
  if (!enabled || !('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* unsupported */ }
}
