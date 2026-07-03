/**
 * DOM utilities. The element builder `h()` sets text via textContent and
 * attributes explicitly, so user data can never be interpreted as HTML —
 * this is our primary XSS defence and replaces the old innerHTML string
 * concatenation throughout the app.
 */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [attrs]  props/attrs. `class`, `text`, `html` (trusted only),
 *                          `dataset`, `on` (event map), and aria-* supported.
 * @param {(Node|string)[]} [children]
 */
export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;             // safe
    else if (k === 'html') node.innerHTML = v;               // callers pass constants only
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k in node && k !== 'list') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escape a string for the rare case raw HTML assembly is unavoidable. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Replace all children of `parent` with `nodes` in one reflow. */
export function replaceChildren(parent, nodes) {
  parent.replaceChildren(...[].concat(nodes).filter(Boolean));
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
