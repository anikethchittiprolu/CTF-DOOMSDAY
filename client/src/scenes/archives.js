import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'archives',
  palette: { bg: '#0c0a14', accent: '#b9a2ff' },
  props: ['Wheel', 'Wheel', 'Wheel', 'Page', 'Page', 'Page', 'Candle', 'Candle', 'Vault', 'Vault', 'Table', 'Table', 'Desk', 'Folio', 'Folio'],
  slots: [[800, 420], [700, 520], [900, 520], [300, 330], [470, 220], [1250, 280], [200, 600], [1400, 600], [320, 700], [1290, 700], [600, 740], [1000, 740], [1120, 420], [480, 470], [800, 250]],
  svg() {
    const r = rng(41);
    let books = '';
    for (let s = 0; s < 2; s++) for (let row = 0; row < 5; row++) {
      let x = s ? 1130 : 60;
      for (let i = 0; i < 17; i++) { const w = 12 + r() * 14, c = ['#5a2a2a', '#2a3a5a', '#3a5a3a', '#5a4a2a', '#4a2a5a'][(r() * 5) | 0]; books += rect(x, 130 + row * 120 + (80 - 60 - r() * 18), w, 70 + r() * 18, c); x += w + 2; }
      books += rect(s ? 1120 : 50, 200 + row * 120, 330, 8, '#2b1e12');
    }
    let ticks = '';
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ticks += `<line x1="${(800 + Math.cos(a) * 168).toFixed(1)}" y1="${(470 + Math.sin(a) * 168).toFixed(1)}" x2="${(800 + Math.cos(a) * 190).toFixed(1)}" y2="${(470 + Math.sin(a) * 190).toFixed(1)}" stroke="#b9a2ff" stroke-width="3"/>${text((792 + Math.cos(a) * 150).toFixed(0), (476 + Math.sin(a) * 150).toFixed(0), 'ABCDEFGHIJKLMNOPQRSTUVWX'[i], 16, '#d8ccff', 'opacity=".8"')}`; }
    let pages = '';
    for (let i = 0; i < 9; i++) pages += `<g class="drift" style="animation-delay:${(i * 0.7).toFixed(1)}s"><rect x="${(250 + r() * 1100).toFixed(0)}" y="${(150 + r() * 380).toFixed(0)}" width="46" height="62" fill="#e7dcc0" opacity=".8" transform="rotate(${(r() * 40 - 20).toFixed(0)})"/></g>`;
    const arch = (x) => `<path d="M${x} 560 L${x} 260 A120 120 0 0 1 ${x + 240} 260 L${x + 240} 560" fill="none" stroke="#2c2640" stroke-width="22"/>`;
    return `<defs>${lin('arBg', [[0, '#120e1e'], [1, '#07050c']])}${rad('arGlow', [[0, '#b9a2ff', 0.45], [1, '#b9a2ff', 0]])}${rad('arCandle', [[0, '#ffb347', 0.6], [1, '#ffb347', 0]])}${lin('arFloor', [[0, '#1a1426'], [1, '#08060c']])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#arBg)') + [440, 680, 920].map(arch).join('') + books +
      poly([[0, 640], [W, 640], [W, H], [0, H]], 'url(#arFloor)') +
      glow(800, 470, 330, 'arGlow') + `<g class="spin" style="transform-origin:800px 470px"><circle cx="800" cy="470" r="200" fill="none" stroke="#6a55b0" stroke-width="10"/>${ticks}</g>` +
      circ(800, 470, 120, '#120e1e', 'stroke="#b9a2ff" stroke-width="4"') + circ(800, 470, 28, '#b9a2ff', 'class="pulse"') + pages +
      [[200, 640], [1400, 640], [330, 740], [1290, 740], [600, 780], [1000, 780]].map(([x, y], i) => glow(x, y - 40, 90, 'arCandle') + rect(x - 5, y - 34, 10, 34, '#e7dcc0') + `<ellipse class="flicker" cx="${x}" cy="${y - 42}" rx="5" ry="10" fill="#ffd479" style="animation-delay:${(i * 0.23).toFixed(2)}s"/>`).join('') +
      overlayVignette;
  },
};
