// Motion-comic broadcasts: a few illustrated panels with slow camera moves and captions.
// Short, skippable, with the same words available in the Codex. No video files to download.
import { sentences, readMs, esc } from '../lib/text.js';
import { audio } from '../audio/audio.js';
import { prefersReducedMotion } from '../lib/prefs.js';
import { rng } from '../scenes/kit.js';
import { markBroadcastSeen } from './shell.js';

const ART = {
  mask: () => `<defs><radialGradient id="bg1"><stop offset="0" stop-color="#1a4a30"/><stop offset="1" stop-color="#030806"/></radialGradient></defs><rect width="1600" height="900" fill="url(#bg1)"/>
    <path d="M300 900 L420 560 Q800 440 1180 560 L1300 900Z" fill="#0f3a24"/><path d="M520 560 Q800 380 1080 560 L1010 330 Q800 220 590 330Z" fill="#17553a"/>
    <path d="M620 200 Q800 90 980 200 L1010 520 Q800 700 590 520Z" fill="#9aa5ab"/><path d="M800 190 L800 600" stroke="#6b767c" stroke-width="3"/>
    <path d="M660 360 L770 390 L770 420 L660 405Z M940 360 L830 390 L830 420 L940 405Z" fill="#04100a"/><path d="M670 380 L765 402 M930 380 L835 402" stroke="#3ddc84" stroke-width="7" class="pulse"/>
    <path d="M740 520 L800 580 L860 520" stroke="#5b666c" stroke-width="5" fill="none"/>`,
  city: () => { const r = rng(4); let b = ''; for (let x = 0; x < 1600; x += 70 + r() * 40) { const h = 200 + r() * 420; b += `<rect x="${x}" y="${900 - h}" width="${60 + r() * 30}" height="${h}" fill="#0b1913"/>`; for (let y = 900 - h + 20; y < 880; y += 28) if (r() > 0.55) b += `<rect x="${x + 10}" y="${y}" width="8" height="12" fill="#3ddc84" opacity=".7"/>`; } return `<rect width="1600" height="900" fill="#050d09"/><circle cx="1200" cy="200" r="80" fill="#d8ffe8" opacity=".6"/>${b}`; },
  cracks: () => { const r = rng(9); let c = ''; for (let i = 0; i < 9; i++) { let x = r() * 1600, y = 0, d = `M${x} 0`; for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 220; y += 90 + r() * 70; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; } c += `<path d="${d}" stroke="#ff4d3a" stroke-width="${3 + r() * 4}" fill="none" class="pulse"/>`; } return `<rect width="1600" height="900" fill="#14060a"/><circle cx="1180" cy="260" r="150" fill="#2a6a4a"/><circle cx="1180" cy="260" r="150" fill="none" stroke="#7ad9ff" stroke-width="4" opacity=".5"/>${c}<rect y="700" width="1600" height="200" fill="#080304"/>`; },
  fire: () => { const r = rng(2); let e = ''; for (let i = 0; i < 40; i++) e += `<circle class="ember" style="animation-delay:${(r() * 5).toFixed(1)}s" cx="${400 + r() * 800}" cy="${650 + r() * 200}" r="${1 + r() * 3}" fill="#ffb347"/>`; return `<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1230"/><stop offset=".7" stop-color="#6a2a2a"/><stop offset="1" stop-color="#e0773a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#fg)"/><path d="M560 900 Q620 560 800 420 Q980 560 1040 900Z" fill="#ff7a2f" opacity=".7" class="flicker"/><path d="M660 900 Q700 640 800 540 Q900 640 940 900Z" fill="#ffd479" class="flicker"/><rect y="820" width="1600" height="80" fill="#0a0506"/>${e}`; },
  engine: () => `<rect width="1600" height="900" fill="#0a0305"/><radialGradient id="eg"><stop offset="0" stop-color="#ffd479"/><stop offset=".4" stop-color="#ff5d5d" stop-opacity=".6"/><stop offset="1" stop-color="#ff5d5d" stop-opacity="0"/></radialGradient><circle cx="800" cy="450" r="420" fill="url(#eg)" class="pulse"/>${[0, 1, 2, 3].map((i) => `<ellipse class="spin" style="transform-origin:800px 450px;animation-duration:${10 + i * 5}s" cx="800" cy="450" rx="${160 + i * 70}" ry="${50 + i * 24}" fill="none" stroke="#ff9f43" stroke-width="4" opacity=".7"/>`).join('')}<circle cx="800" cy="450" r="50" fill="#fff3d0"/>`,
};
const ARTS = ['mask', 'city', 'cracks', 'fire', 'engine'];
const artFor = (hour) => ({ 0: 'mask', 3: 'city', 6: 'mask', 9: 'cracks', 12: 'engine', 15: 'cracks', 18: 'fire', 21: 'cracks', 24: 'mask' }[hour] ?? ARTS[(hour / 3) % 5]);

let active = null;
/** Resolves when the broadcast ends or is skipped. */
export function playBroadcast(layer, b) {
  if (active) active.finish();
  return new Promise((resolve) => {
    const caps = sentences(b.text);
    const total = caps.reduce((a, s) => a + readMs(s), 0);
    const el = document.createElement('div'); el.id = 'broadcast'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Broadcast from Doom'); el.setAttribute('aria-modal', 'true');
    const kind = artFor(b.hour);
    el.innerHTML = `<div class="art"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="${prefersReducedMotion() ? '' : 'panel-fx'}" aria-hidden="true">${ART[kind]()}</svg>
      <div class="top"><span>Address from the sovereign &middot; ${esc(b.title)}</span><button class="btn small" id="bc-skip" data-autofocus>Skip (Esc)</button></div></div>
      <div><div class="bar"><i id="bc-bar"></i></div><div class="cap" id="bc-cap" aria-live="polite"></div></div>`;
    layer.appendChild(el);
    const prevFocus = document.activeElement;
    el.querySelector('#bc-skip').focus();
    const cap = el.querySelector('#bc-cap'), bar = el.querySelector('#bc-bar');
    let i = 0, elapsed = 0, done = false, timer = null;
    audio.sfx('whoosh');
    const show = () => {
      if (done) return;
      if (i >= caps.length) { finish(); return; }
      cap.textContent = caps[i]; audio.sfx('talk');
      const d = readMs(caps[i]); elapsed += d; bar.style.width = Math.min(100, (elapsed / total) * 100) + '%';
      i++; timer = setTimeout(show, d);
    };
    function finish() {
      if (done) return; done = true; clearTimeout(timer); document.removeEventListener('keydown', onKey, true);
      el.remove(); active = null; markBroadcastSeen(b.key); try { prevFocus?.focus?.(); } catch { /* gone */ } resolve();
    }
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); finish(); } };
    document.addEventListener('keydown', onKey, true);
    el.querySelector('#bc-skip').addEventListener('click', finish);
    active = { finish }; show();
  });
}
