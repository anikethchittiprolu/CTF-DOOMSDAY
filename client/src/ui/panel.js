import { audio } from '../audio/audio.js';

let layer = null, current = null;
export const initPanels = (el) => { layer = el; };
export const panelOpen = () => !!current;

/** One modal panel at a time. Esc closes, Tab stays inside, focus returns afterwards. */
export function openPanel({ title, html = '', cls = '', onClose, labelledby = 'panel-title' }) {
  closePanel();
  const prevFocus = document.activeElement;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<section class="panel ${cls}" role="dialog" aria-modal="true" aria-labelledby="${labelledby}">
    <div class="panel-head"><h2 id="${labelledby}">${title}</h2><button class="btn small" data-close aria-label="Close">Close (Esc)</button></div>
    <div class="panel-body">${html}</div></section>`;
  layer.appendChild(ov);
  const panel = ov.querySelector('.panel');
  const close = () => { if (current?.ov !== ov) return; ov.remove(); current = null; document.removeEventListener('keydown', onKey, true); try { prevFocus?.focus?.(); } catch { /* gone */ } onClose?.(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select, a[href], [tabindex="0"]')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  panel.querySelector('[data-close]').addEventListener('click', close);
  current = { ov, close, panel, body: panel.querySelector('.panel-body') };
  audio.sfx('open');
  (panel.querySelector('[data-autofocus]') || panel.querySelector('[data-close]')).focus();
  return current;
}
export function closePanel() { current?.close(); }
export const currentPanel = () => current;
