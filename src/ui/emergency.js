/**
 * Emergency view — the orchestrator for an active SOS. On trigger it:
 *   1. captures location and records a structured incident (feature H)
 *   2. renders the glass alert panel with live status
 *   3. auto-dispatches to the network, patching the incident status
 *   4. starts live location tracking (A), audio recording (F), flashlight (G)
 * On stand-down it tears every one of those down and closes out the incident.
 */
import { $, h } from '../dom.js';
import { lastFix, mapsUrl, getFix, watch, stopWatch } from '../services/location.js';
import { sendAlert, sendUpdate, smsHref, shareAlert, copyText, alertMessage } from '../services/dispatch.js';
import { getContacts, getPrimaryContact } from './contacts.js';
import { addLog, addIncident, updateIncident } from './log.js';
import { toast } from './toast.js';
import { haptic } from '../utils/util.js';
import { openSheet } from './sheets.js';
import { TUNING } from '../config.js';

/** Turn a transition reason into a short trigger label for the incident record. */
function triggerType(reason = '') {
  const r = reason.toLowerCase();
  if (r.includes('shake')) return 'shake';
  if (r.includes('said')) return 'voice';
  if (r.includes('timer')) return 'safety timer';
  if (r.includes('held') || r.includes('tapped') || r.includes('help')) return 'manual';
  return 'manual';
}

export function mountEmergency(ctx) {
  const { machine, settings, bus, features = {} } = ctx;
  const { recorder, flashlight } = features;
  const actions = $('#actions');
  let incident = null;
  let trackStart = 0;

  bus.on('state:trigger', async ({ reason }) => {
    await getFix();                                  // best-effort fix before rendering links
    const contacts = getContacts();
    incident = addIncident({ trigger: triggerType(reason), locationUrl: mapsUrl(), contactsNotified: contacts.length });

    showPanel();
    if (settings.autosend) runDispatch();
    startEvidence();                                 // A / F / G

    if (contacts.length) addLog(`Pinged ${contacts.length} trusted contact${contacts.length > 1 ? 's' : ''}`, { alarm: true });
  });

  bus.on('state:standdown', standdown);

  /* ---------- panel ---------- */
  function showPanel() {
    actions.classList.add('triggered');
    const contacts = getContacts();
    const primary = getPrimaryContact();
    const ordered = primary ? [primary, ...contacts.filter((c) => c.id !== primary.id)] : contacts;
    const fix = lastFix();

    const sms = h('a', {
      class: 'b-primary', id: 'p-sms',
      href: contacts.length ? smsHref(ordered) : '#',
      text: contacts.length ? `Text my circle (${contacts.length})` : 'Add contacts to text',
      on: { click: (e) => { if (!contacts.length) { e.preventDefault(); toast('Add a contact first', 'warn'); openSheet('sheet-contacts'); } } },
    });
    const share = h('button', { class: 'b-second', text: 'Share location', on: { click: async () => { const r = await shareAlert(); if (r === 'copied') toast('Copied — share it anywhere', 'ok'); } } });
    const copy = h('button', { class: 'b-ghost', text: 'Copy alert', on: { click: async () => { await copyText(alertMessage()); toast('Alert copied', 'ok'); } } });

    const statusRows = h('div', { class: 'live-rows', id: 'live-rows' });

    const panel = h('div', { class: 'panel', id: 'panel', role: 'region', 'aria-label': 'Emergency alert' }, [
      h('h3', { text: 'Alert ready' }),
      h('div', { class: 'sendstate', id: 'sendstate', role: 'status', text: settings.autosend ? 'Preparing…' : 'Auto-send is off — use the buttons below.' }),
      h('p', { class: 'loc' }, fix
        ? ['Location captured. ', h('a', { href: mapsUrl(), target: '_blank', rel: 'noopener', text: 'Open map' })]
        : ["Couldn't get your location — send the text and call directly."]),
      statusRows,
      h('div', { class: 'sendcol' }, [sms, share, copy]),
    ]);

    const safe = h('button', { class: 'safe', id: 'safe' }, [h('span', { class: 'fill' }), h('span', { text: 'Hold to mark safe' })]);
    bindHold(safe, () => machine.cancel('safe'));

    $('#panel')?.remove(); $('#safe')?.remove();
    actions.insertBefore(panel, actions.firstChild);
    actions.append(safe);
  }

  function liveRow(id, label) {
    let row = document.getElementById(id);
    if (!row) { row = h('div', { class: 'live-row', id }, [h('span', { class: 'dot' }), h('span', { class: 'lr-text', text: label })]); $('#live-rows')?.append(row); }
    return row;
  }
  function setLiveRow(id, label) { const r = document.getElementById(id); if (r) r.querySelector('.lr-text').textContent = label; }

  /* ---------- network ---------- */
  async function runDispatch() {
    setSendState('Notifying your circle…', '');
    const result = await sendAlert({ contacts: getContacts(), webhook: settings.webhook });
    setSendState(result.summary, result.anySent ? 'ok' : 'warn');
    if (incident) updateIncident(incident.id, { status: result.anySent ? 'delivered' : 'manual' });
    addLog(result.anySent ? `Alert delivered · ${result.summary.replace('Sent automatically via ', '')}` : 'Auto-send unavailable — manual fallback', { alarm: true });
  }

  function setSendState(text, kind) {
    const s = $('#sendstate');
    if (s) { s.textContent = text; s.className = `sendstate ${kind}`.trim(); }
  }

  /* ---------- live evidence: tracking (A), recording (F), flashlight (G) ---------- */
  function startEvidence() {
    if (settings.track) {
      trackStart = Date.now();
      liveRow('lr-track', 'Live location on · sharing every 15s');
      watch((fix) => {
        setLiveRow('lr-track', `Live location on · updated ${Math.max(0, Math.round((Date.now() - fix.at) / 1000))}s ago`);
        if (settings.autosend) sendUpdate({ fix, contacts: getContacts(), webhook: settings.webhook }).catch(() => {});
      }, TUNING.trackIntervalMs);
    }

    if (settings.record && recorder?.supported) {
      liveRow('lr-rec', 'Recording audio…');
      recorder.start().then((ok) => setLiveRow('lr-rec', ok ? 'Recording audio…' : 'Mic unavailable'));
    }

    if (settings.flashlight && flashlight?.supported) {
      flashlight.start().then((ok) => { if (ok) liveRow('lr-flash', 'Flashlight SOS on'); });
    }
  }

  async function standdown() {
    stopWatch();
    flashlight?.stop().catch(() => {});
    if (recorder?.active) {
      const out = await recorder.stop();
      if (out) toast(out.uploaded ? 'Recording saved to the cloud' : 'Recording saved to your device', 'ok');
    }
    if (incident) { updateIncident(incident.id, { status: 'stood-down' }); incident = null; }
    restore();
  }

  function restore() {
    actions.classList.remove('triggered');
    $('#panel')?.remove();
    $('#safe')?.remove();
  }
}

/** Press-and-hold gesture with a filling bar; runs `onComplete` at 100%. */
function bindHold(btn, onComplete) {
  let timer = null, frac = 0;
  const fill = btn.querySelector('.fill');
  const start = (e) => {
    e.preventDefault(); frac = 0;
    timer = setInterval(() => {
      frac += 1 / 28;
      fill.style.width = `${Math.min(100, frac * 100)}%`;
      if (frac >= 1) { clearInterval(timer); haptic([40], true); onComplete(); }
    }, 40);
  };
  const stop = () => { clearInterval(timer); if (fill) fill.style.width = '0'; };
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
}
