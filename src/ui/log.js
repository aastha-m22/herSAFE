/**
 * Activity log + emergency history (feature H).
 *  - Activity log: lightweight, every state change (shown in Settings).
 *  - Incidents: structured emergency records — time, trigger type, location,
 *    contacts notified, alert status — shown in the History sheet.
 */
import { store } from '../store.js';
import { h, replaceChildren } from '../dom.js';
import { clockTime } from '../utils/util.js';
import { TUNING } from '../config.js';

let entries = store.get('log', []);
let incidents = store.get('incidents', []);
let listEl = null;
let historyEl = null;

/* ---------- activity log ---------- */
export function mountLog(container) { listEl = container; renderLog(); }

export function addLog(message, { alarm = false } = {}) {
  const entry = { t: clockTime(), m: message, alarm };
  entries.unshift(entry);
  entries = entries.slice(0, TUNING.logCap);
  store.set('log', entries);
  renderLog();
  return entry;
}

export function clearLog() { entries = []; store.set('log', entries); renderLog(); }

function renderLog() {
  if (!listEl) return;
  if (!entries.length) {
    replaceChildren(listEl, h('div', { class: 'empty', style: 'padding:14px 0', text: 'Nothing yet. Every state change shows up here.' }));
    return;
  }
  replaceChildren(listEl, entries.map((l) =>
    h('div', { class: `logitem ${l.alarm ? 'alarm' : ''}` }, [h('time', { text: l.t }), h('span', { text: l.m })])));
}

/* ---------- emergency incidents ---------- */
export function mountHistory(container) { historyEl = container; renderHistory(); }

/**
 * Record an emergency. @returns the incident so the caller can patch `status`
 * once dispatch resolves.
 */
export function addIncident({ trigger, locationUrl, contactsNotified }) {
  const incident = {
    id: crypto.randomUUID?.() || String(Date.now()),
    at: new Date().toISOString(),
    trigger: trigger || 'manual',
    locationUrl: locationUrl || '',
    contactsNotified: contactsNotified ?? 0,
    status: 'pending',
  };
  incidents.unshift(incident);
  incidents = incidents.slice(0, TUNING.incidentCap);
  store.set('incidents', incidents);
  renderHistory();
  return incident;
}

export function updateIncident(id, patch) {
  incidents = incidents.map((i) => (i.id === id ? { ...i, ...patch } : i));
  store.set('incidents', incidents);
  renderHistory();
}

export function clearIncidents() { incidents = []; store.set('incidents', incidents); renderHistory(); }
export function getIncidents() { return incidents; }

function fmtWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = { pending: 'Sending…', delivered: 'Delivered', manual: 'Manual only', 'stood-down': 'Stood down' };

function renderHistory() {
  if (!historyEl) return;
  if (!incidents.length) {
    replaceChildren(historyEl, h('div', { class: 'empty', text: 'No incidents recorded. This is a good thing.' }));
    return;
  }
  replaceChildren(historyEl, incidents.map((i) =>
    h('div', { class: 'incident' }, [
      h('div', { class: 'inc-top' }, [
        h('b', { text: fmtWhen(i.at) }),
        h('span', { class: `inc-status ${i.status}`, text: STATUS_LABEL[i.status] || i.status }),
      ]),
      h('div', { class: 'inc-meta' }, [
        h('span', { text: `Trigger: ${i.trigger}` }),
        h('span', { text: `Notified: ${i.contactsNotified}` }),
      ]),
      i.locationUrl
        ? h('a', { class: 'inc-loc', href: i.locationUrl, target: '_blank', rel: 'noopener', text: 'Open location' })
        : h('span', { class: 'inc-loc muted', text: 'No location captured' }),
    ])));
}
