/**
 * Trusted-circle contacts (feature B). Full CRUD with inline editing, a primary
 * contact, and phone validation. Rendering is XSS-safe via the `h()` builder.
 */
import { store } from '../store.js';
import { $, h, replaceChildren } from '../dom.js';
import { isValidPhone, normalizePhone, sanitizeText, haptic } from '../utils/util.js';
import { toast } from './toast.js';

let contacts = normalize(store.get('contacts', []));
let listEl = null;
let badgeEls = [];
let editingId = null;

/** Back-fill ids and ensure exactly one primary exists. */
function normalize(list) {
  let arr = (Array.isArray(list) ? list : []).map((c) => ({
    id: c.id || crypto.randomUUID?.() || String(Math.random()),
    name: c.name || '',
    phone: c.phone || '',
    primary: !!c.primary,
  }));
  if (arr.length && !arr.some((c) => c.primary)) arr[0].primary = true;
  return arr;
}

export function getContacts() { return contacts; }
export function getPrimaryContact() { return contacts.find((c) => c.primary) || contacts[0] || null; }

function persist() { store.set('contacts', contacts); render(); }

export function mountContacts({ list, badges = [] }) {
  listEl = list; badgeEls = badges;
  render();

  const nameInput = $('#c-name');
  const phoneInput = $('#c-phone');
  const err = $('#c-err');

  const submit = () => {
    const name = sanitizeText(nameInput.value, 40);
    const phone = phoneInput.value.trim();
    if (!name) { err.textContent = 'Please add a name.'; nameInput.focus(); return; }
    if (!isValidPhone(phone)) { err.textContent = 'Enter a valid phone number (7–15 digits).'; phoneInput.setAttribute('aria-invalid', 'true'); phoneInput.focus(); return; }
    err.textContent = '';
    phoneInput.removeAttribute('aria-invalid');
    contacts.push({ id: crypto.randomUUID?.() || String(Date.now()), name, phone: normalizePhone(phone), primary: contacts.length === 0 });
    persist();
    nameInput.value = ''; phoneInput.value = '';
    haptic([30], true);
    toast('Contact added', 'ok');
    nameInput.focus();
  };

  $('#c-add').addEventListener('click', submit);
  phoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  phoneInput.addEventListener('input', () => phoneInput.removeAttribute('aria-invalid'));
}

function setPrimary(id) {
  contacts = contacts.map((c) => ({ ...c, primary: c.id === id }));
  persist();
  toast('Primary contact set', 'ok');
}

function remove(id) {
  const wasPrimary = contacts.find((c) => c.id === id)?.primary;
  contacts = contacts.filter((c) => c.id !== id);
  if (wasPrimary && contacts.length) contacts[0].primary = true;
  persist();
  toast('Contact removed');
}

function saveEdit(id, name, phone) {
  const clean = sanitizeText(name, 40);
  if (!clean) { toast('Name required', 'warn'); return false; }
  if (!isValidPhone(phone)) { toast('Invalid phone number', 'warn'); return false; }
  contacts = contacts.map((c) => (c.id === id ? { ...c, name: clean, phone: normalizePhone(phone) } : c));
  editingId = null;
  persist();
  toast('Contact updated', 'ok');
  return true;
}

/* ---------- rendering ---------- */
function render() {
  badgeEls.forEach((b) => { if (b) b.textContent = String(contacts.length); });
  if (!listEl) return;

  if (!contacts.length) {
    replaceChildren(listEl, h('div', { class: 'empty', html: 'No one here yet.<br>Add the people you trust most.' }));
    return;
  }
  replaceChildren(listEl, contacts.map((c) => (c.id === editingId ? editRow(c) : viewRow(c))));
}

function viewRow(c) {
  const star = h('button', {
    class: `star ${c.primary ? 'on' : ''}`, 'aria-pressed': String(c.primary),
    'aria-label': c.primary ? `${c.name} is your primary contact` : `Make ${c.name} primary`,
    title: c.primary ? 'Primary contact' : 'Make primary',
    on: { click: () => setPrimary(c.id) },
    html: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>',
  });
  return h('div', { class: 'contact' }, [
    h('div', { class: 'av', text: (c.name[0] || '?').toUpperCase() }),
    h('div', { class: 'meta' }, [
      h('b', {}, [c.name, c.primary ? h('span', { class: 'tag', text: 'Primary' }) : null]),
      h('small', { text: c.phone }),
    ]),
    h('div', { class: 'contact-actions' }, [
      star,
      h('button', { class: 'iconlink', 'aria-label': `Edit ${c.name}`, title: 'Edit', on: { click: () => { editingId = c.id; render(); } }, html: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' }),
      h('button', { class: 'del', 'aria-label': `Remove ${c.name}`, text: '✕', on: { click: () => remove(c.id) } }),
    ]),
  ]);
}

function editRow(c) {
  const name = h('input', { type: 'text', class: 'edit-name', value: c.name, 'aria-label': 'Name' });
  const phone = h('input', { type: 'tel', class: 'edit-phone', value: c.phone, 'aria-label': 'Phone', inputmode: 'tel' });
  const commit = () => { if (saveEdit(c.id, name.value, phone.value)) {/* re-rendered */} };
  phone.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  return h('div', { class: 'contact editing' }, [
    h('div', { class: 'edit-fields' }, [name, phone]),
    h('div', { class: 'contact-actions' }, [
      h('button', { class: 'add sm', text: 'Save', on: { click: commit } }),
      h('button', { class: 'iconlink', 'aria-label': 'Cancel edit', text: '✕', on: { click: () => { editingId = null; render(); } } }),
    ]),
  ]);
}
