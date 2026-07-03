/**
 * Home quick-tools: Fake call (C), Safety timer (D), and Safe check-in (E).
 * Renders the tools row, the active-timer banner, and the timer sheet; delegates
 * the actual work to the FakeCall / SafetyTimer instances and the dispatch layer.
 */
import { $, $$ } from '../dom.js';
import { store } from '../store.js';
import { toast } from './toast.js';
import { openSheet, closeSheet } from './sheets.js';
import { formatRemaining } from '../features/safetyTimer.js';
import { getContacts } from './contacts.js';
import { sendCheckIn, smsHref, checkInMessage } from '../services/dispatch.js';
import { haptic } from '../utils/util.js';

export function mountTools(ctx) {
  const { settings, bus, fakeCall, safetyTimer } = ctx;

  /* ---- Fake call ---- */
  $('#tool-fakecall').addEventListener('click', () => {
    const ms = fakeCall.schedule();
    toast(`${settings.fakeCallName || 'Call'} will ring in ${Math.round(ms / 1000)}s`, 'ok');
    haptic([20], settings.vibe);
  });

  /* ---- Safety timer ---- */
  const banner = $('#timer-banner');
  $('#tool-timer').addEventListener('click', () => openSheet('sheet-timer'));

  let selected = 30;
  const presets = $$('#timer-presets button');
  const applySel = (v) => { selected = v; presets.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === v))); $('#timer-custom-val').textContent = `${v} min`; };
  presets.forEach((b) => b.addEventListener('click', () => applySel(Number(b.dataset.min))));
  $('#timer-minus').addEventListener('click', () => applySel(Math.max(5, selected - 5)));
  $('#timer-plus').addEventListener('click', () => applySel(Math.min(180, selected + 5)));
  applySel(30);

  $('#timer-start').addEventListener('click', () => {
    safetyTimer.start(selected);
    closeSheet();
    toast(`Safety timer set for ${selected} min`, 'ok');
  });

  bus.on('timer:tick', (ms) => {
    banner.hidden = false;
    $('#timer-remaining').textContent = formatRemaining(ms);
  });
  bus.on('timer:done', () => { banner.hidden = true; });

  $('#timer-extend').addEventListener('click', () => { safetyTimer.extend(10); toast('Added 10 minutes', 'ok'); });
  $('#timer-safe').addEventListener('click', () => { safetyTimer.cancel(); banner.hidden = true; toast("Safety timer cleared — glad you're okay", 'ok'); });

  /* ---- Safe check-in ---- */
  $('#tool-checkin').addEventListener('click', async () => {
    const contacts = getContacts();
    if (!contacts.length) { toast('Add a contact first', 'warn'); openSheet('sheet-contacts'); return; }
    toast('Sending check-in…');
    const res = await sendCheckIn({ contacts, webhook: settings.webhook });
    if (res.anySent) toast(res.summary, 'ok');
    else { toast('Opening a text instead…', 'warn'); window.location.href = smsHref(contacts, checkInMessage()); }
  });
}
