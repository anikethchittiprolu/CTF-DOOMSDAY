// The 2D fallback map: same regions, same labels, no canvas. Used when the benchmark fails
// or WebGL is unavailable.
import { rng, lin, rad } from '../scenes/kit.js';

export function createMapFlat(host, { regions, getStatus, onSelect, onHover }) {
  const wrap = document.createElement('div'); wrap.className = 'mapflat';
  const r = rng(5);
  let contours = '';
  for (let i = 0; i < 9; i++) contours += `<ellipse cx="800" cy="450" rx="${280 + i * 62}" ry="${150 + i * 42}" fill="none" stroke="#2a3d34" stroke-width="1.5" opacity="${0.5 - i * 0.04}" transform="rotate(${i * 3} 800 450)"/>`;
  let cracks = '';
  for (let i = 0; i < 7; i++) { let x = r() * 1600, y = r() * 300, d = `M${x.toFixed(0)} ${y.toFixed(0)}`; for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 160; y += 30 + r() * 70; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; } cracks += `<path d="${d}" stroke="#ff4d3a" stroke-width="2.5" fill="none"/>`; }
  wrap.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${rad('mfBg', [[0, '#12251d'], [1, '#050908']])}</defs>
    <rect width="1600" height="900" fill="url(#mfBg)"/>${contours}
    <g class="mf-cracks" opacity="0">${cracks}</g>
    ${regions.map((g) => `<g data-r="${g.id}" class="mf-blob"><circle cx="${g.map.x * 1600}" cy="${g.map.y * 900}" r="62" fill="#17251f" stroke="#2f4a3d" stroke-width="2"/><circle class="mf-ring" cx="${g.map.x * 1600}" cy="${g.map.y * 900}" r="76" fill="none" stroke="#3ddc84" stroke-width="2" stroke-dasharray="6 8" opacity="0"/></g>`).join('')}
  </svg><div class="map-labels"></div>`;
  host.prepend(wrap);
  const layer = wrap.querySelector('.map-labels'), cracksEl = wrap.querySelector('.mf-cracks');
  const labels = {};
  for (const g of regions) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'map-label'; el.dataset.region = g.id;
    el.style.left = g.map.x * 100 + '%'; el.style.top = g.map.y * 100 + '%'; el.style.transform = 'translate(-50%, -50%)';
    el.addEventListener('click', () => onSelect(g.id));
    el.addEventListener('mouseenter', () => onHover?.(g.id)); el.addEventListener('mouseleave', () => onHover?.(null));
    layer.appendChild(el); labels[g.id] = el;
  }
  const refresh = () => {
    for (const g of regions) {
      const s = getStatus(g.id), el = labels[g.id];
      const key = s.cleared ? 'cleared' : s.fresh ? 'fresh' : s.released > 0 ? 'open' : 'locked';
      el.dataset.state = key;
      el.innerHTML = `<span class="ml-name">${g.name}</span><span class="ml-meta">${s.released}/${s.total} open &middot; ${s.solved} solved</span>`;
      el.setAttribute('aria-label', `${g.name}. ${s.released} of ${s.total} challenges open, ${s.solved} solved. Press Enter to travel.`);
      const ring = wrap.querySelector(`[data-r="${g.id}"] .mf-ring`);
      ring.setAttribute('opacity', s.released > 0 ? '0.8' : '0.15');
      ring.setAttribute('stroke', key === 'cleared' ? '#e0a63a' : '#3ddc84');
    }
  };
  return {
    start: refresh, stop() {}, refresh, labels, focus() {}, onLost() {}, info: () => ({ triangles: 0, calls: 0 }),
    setIncursion(v) { cracksEl.setAttribute('opacity', String(Math.max(0, Math.min(1, v * 1.4 - 0.2)))); },
    benchmark: () => Promise.resolve({ ok: true, fps: 60 }),
    dispose() { wrap.remove(); },
  };
}
