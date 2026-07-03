/**
 * Toast notifications. Stacks multiple messages, auto-dismisses, and supports
 * variants (info/ok/warn/error). Replaces the old single-element toast that
 * clobbered itself when two events fired close together.
 */
import { h } from '../dom.js';

let stack;

function ensureStack() {
  if (!stack) {
    stack = h('div', { class: 'toast-stack', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.append(stack);
  }
  return stack;
}

/**
 * @param {string} message
 * @param {'info'|'ok'|'warn'|'error'} [variant]
 * @param {number} [ms] visible duration
 */
export function toast(message, variant = 'info', ms = 2600) {
  const el = h('div', { class: `toast ${variant}`, role: 'status' }, [
    h('span', { class: 'dot' }),
    h('span', { text: message }),
  ]);
  ensureStack().append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const remove = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 240); };
  setTimeout(remove, ms);
  return remove;
}
