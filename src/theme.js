/**
 * Theme controller: 'system' | 'light' | 'dark'.
 * Applies to <html data-theme>, keeps the PWA theme-color meta in sync, and
 * reacts live to OS changes while in 'system' mode.
 */
import { store } from './store.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;
const themeMeta = document.querySelector('meta[name="theme-color"]');

const THEME_COLORS = { light: '#F3F1EC', dark: '#14161A' };

function effective(pref) {
  return pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
}

function paint(pref) {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[effective(pref)]);
}

export function initTheme(pref = 'system') {
  paint(pref);
  // live-update when OS scheme flips and we're following it
  media.addEventListener('change', () => {
    if ((store.get('settings', {}).theme || 'system') === 'system') paint('system');
  });
}

export function setTheme(pref) { paint(pref); }
export function currentScheme(pref) { return effective(pref); }
