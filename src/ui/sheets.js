/**
 * Bottom-sheet controller. Handles open/close, the shared scrim, Escape-to-close,
 * body scroll lock, and moving focus into the sheet for keyboard/AT users.
 */
import { $, $$ } from '../dom.js';

let openId = null;

function scrims() { return $$('.scrim'); }

export function openSheet(id) {
  closeSheet();
  const sheet = document.getElementById(id);
  if (!sheet) return;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  scrims().forEach((s) => s.classList.add('open'));
  document.body.style.overflow = 'hidden';
  openId = id;
  // focus the first control (or the sheet) for accessibility
  const focusable = sheet.querySelector('input, button, [tabindex]');
  (focusable || sheet).focus?.({ preventScroll: true });
}

export function closeSheet() {
  if (openId) {
    const sheet = document.getElementById(openId);
    sheet?.classList.remove('open');
    sheet?.setAttribute('aria-hidden', 'true');
  }
  scrims().forEach((s) => s.classList.remove('open'));
  document.body.style.overflow = '';
  openId = null;
}

export function initSheets() {
  $$('[data-close], .scrim, .grab').forEach((el) => el.addEventListener('click', closeSheet));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) closeSheet(); });
}
