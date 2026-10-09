import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, mountains, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'haasenstadt',
  palette: { bg: '#1a0f14', accent: '#ff9f43' },
  props: ['Wagon', 'Wagon', 'Wagon', 'Medic', 'Medic', 'Letters', 'Letters', 'Ledger', 'Ledger', 'Radio', 'Radio', 'Tent', 'Tent', 'Ash', 'Ash'],
  slots: [[430, 640], [520, 700], [350, 710], [840, 660], [920, 720], [1180, 650], [1250, 720], [1380, 690], [200, 760], [660, 770], [1060, 770], [180, 600], [1480, 620], [760, 560], [1130, 580]],
  svg() {
    const r = rng(53);
    let embers = '';
    for (let i = 0; i < 40; i++) embers += `<circle class="ember" style="animation-delay:${(r() * 6).toFixed(2)}s;animation-duration:${(4 + r() * 4).toFixed(1)}s" cx="${(300 + r() * 700).toFixed(0)}" cy="${(620 + r() * 200).toFixed(0)}" r="${(1 + r() * 2.4).toFixed(1)}" fill="#ffb347"/>`;
    const tree = (x, h) => poly([[x, 620], [x + 18, 620], [x + 9, 620 - h]], '#0b0709') + rect(x + 6, 600, 6, 40, '#0b0709');
    return `<defs>${lin('haSky', [[0, '#1b1230'], [0.55, '#5a2a3a'], [1, '#e0773a']])}${lin('haGround', [[0, '#2a1a18'], [1, '#0d0808']])}${rad('haFire', [[0, '#ff8a3a', 0.6], [1, '#ff8a3a', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#haSky)') + stars(r, 24, 0, 220, '#fde') + circ(1260, 170, 46, '#ffe9cf', 'opacity=".9"') +
      mountains(r, 560, 80, 200, '#1d0f1a', 160) + Array.from({ length: 16 }, (_, i) => tree(40 + i * 100, 80 + (i * 37) % 60)).join('') +
      poly([[0, 620], [W, 620], [W, H], [0, H]], 'url(#haGround)') +
      `<g>${rect(330, 560, 240, 110, '#0e0808')}${rect(340, 520, 8, 50, '#0e0808')}${rect(560, 520, 8, 50, '#0e0808')}<path d="M345 520 Q450 440 565 520" stroke="#0e0808" stroke-width="10" fill="none"/>${circ(380, 680, 38, '#0a0606')}${circ(380, 680, 28, '#2a1a18')}${circ(520, 680, 38, '#0a0606')}${circ(520, 680, 28, '#2a1a18')}</g>` +
      glow(450, 600, 260, 'haFire') +
      poly([[780, 700], [900, 560], [1020, 700]], '#2a1f2a') + rect(870, 640, 60, 60, '#0b0709') + poly([[1140, 700], [1250, 580], [1360, 700]], '#33242f') +
      `<g>${rect(150, 740, 150, 24, '#170d0d')}${rect(160, 720, 20, 20, '#170d0d')}</g>` +
      [[600, 780], [1000, 790], [250, 800]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="90" ry="18" fill="#3a2a28" opacity=".6"/>`).join('') +
      embers + text(80, 70, 'HAASENSTADT . THE THIRD HOUR', 18, '#ffd5b0', 'opacity=".55"') + overlayVignette;
  },
};
