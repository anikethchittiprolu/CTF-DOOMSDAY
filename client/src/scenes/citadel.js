import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'citadel',
  palette: { bg: '#180607', accent: '#ff5d5d' },
  props: ['Tree', 'Tree', 'Tree', 'Throne', 'Throne', 'Gate', 'Gate', 'Engine', 'Engine', 'Engine', 'Core', 'Core', 'Orb', 'Orb', 'Orb'],
  slots: [[800, 330], [640, 250], [960, 250], [800, 560], [700, 610], [330, 540], [1270, 540], [800, 780], [660, 820], [940, 820], [560, 770], [1040, 770], [260, 300], [1360, 300], [800, 160]],
  svg() {
    const r = rng(103);
    let orbs = '';
    for (let i = 0; i < 16; i++) orbs += `<g class="drift" style="animation-delay:${(i * 0.8).toFixed(1)}s">${circ(200 + r() * 1200, 90 + r() * 360, 7 + r() * 9, ['#ff9f43', '#b36bff', '#3ddc84', '#4aa3ff'][i % 4], 'opacity=".65"')}</g>`;
    const branch = (x1, y1, x2, y2, w) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (y1 - y2) * 0.15} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="#2b1713" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    return `<defs>${lin('ciSky', [[0, '#1a0204'], [0.5, '#4a0f12'], [1, '#2a0a0e']])}${rad('ciCore', [[0, '#ffd479', 0.95], [0.4, '#ff5d5d', 0.5], [1, '#ff5d5d', 0]])}${rad('ciLeaf', [[0, '#ff9f43', 0.35], [1, '#ff9f43', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#ciSky)') + stars(r, 50, 0, 400, '#fdd') + glow(800, 230, 460, 'ciLeaf') + orbs +
      `<path d="M740 620 Q700 420 760 300 L840 300 Q900 420 860 620 Z" fill="#2b1713"/>` + branch(780, 340, 520, 200, 26) + branch(820, 340, 1080, 200, 26) + branch(790, 400, 420, 380, 20) + branch(810, 400, 1180, 380, 20) + branch(790, 300, 700, 90, 18) + branch(810, 300, 900, 90, 18) +
      [[520, 200], [1080, 200], [420, 380], [1180, 380], [700, 90], [900, 90], [800, 200]].map(([x, y]) => circ(x, y, 70, '#5a1c14', 'opacity=".55"') + circ(x - 20, y + 10, 36, '#8a2a1c', 'opacity=".5"')).join('') +
      poly([[0, 620], [W, 620], [W, H], [0, H]], '#0e0405') +
      `<g>${rect(720, 570, 160, 40, '#2a1210')}${rect(740, 480, 120, 90, '#3a1a16')}${rect(760, 400, 80, 90, '#4a2018')}${rect(790, 420, 20, 26, '#ff5d5d', 'class="pulse"')}${rect(766, 490, 68, 12, '#1a0808')}` +
      `${circ(800, 470, 16, '#1a0808')}${poly([[780, 480], [820, 480], [832, 560], [768, 560]], '#1a0808')}</g>` +
      `<ellipse cx="800" cy="800" rx="260" ry="70" fill="#190608" stroke="#ff5d5d" stroke-width="4"/>` + glow(800, 790, 260, 'ciCore', 'class="pulse"') + circ(800, 790, 34, '#ffd479') +
      [0, 1, 2].map((i) => `<ellipse class="spin" style="transform-origin:800px 790px;animation-duration:${14 + i * 6}s" cx="800" cy="790" rx="${120 + i * 40}" ry="${34 + i * 10}" fill="none" stroke="#ff9f43" stroke-width="3" opacity=".6"/>`).join('') +
      text(560, 880, 'THE DOOMSDAY ENGINE . STANDBY', 18, '#ff5d5d', 'opacity=".6"') + overlayVignette;
  },
};
