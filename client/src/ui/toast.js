import { esc } from '../lib/text.js';
import { audio } from '../audio/audio.js';

let host = null;
export function initToasts(el) { host = el; }
/** Non-modal notice. Never steals focus, so it is safe while a flag field is focused. */
export function toast(html, { kind = 'info', ms = 6000, action = null, sound = null } = {}) {
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`; el.innerHTML = html;
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); el.remove(); }); el.appendChild(b);
  }
  host.appendChild(el);
  if (sound) audio.sfx(sound);
  while (host.children.length > 4) host.firstChild.remove();
  setTimeout(() => el.remove(), ms);
  return el;
}
export const toastText = (t, o) => toast(esc(t), o);
