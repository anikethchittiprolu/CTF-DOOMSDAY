import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, mountains, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'monastery',
  palette: { bg: '#0a1018', accent: '#9fd6ff' },
  props: ['Circle', 'Circle', 'Circle', 'Forge', 'Forge', 'Mask', 'Mask', 'Altar', 'Altar', 'Bell', 'Bell', 'Gate', 'Gate', 'Cell', 'Cell'],
  slots: [[800, 760], [660, 780], [940, 780], [1190, 520], [1280, 580], [800, 420], [700, 480], [440, 520], [360, 580], [200, 640], [1420, 640], [530, 700], [1070, 700], [160, 540], [1470, 560]],
  svg() {
    const r = rng(67);
    let snow = '';
    for (let i = 0; i < 70; i++) snow += `<circle class="snow" style="animation-delay:${(r() * 8).toFixed(2)}s;animation-duration:${(6 + r() * 5).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="0" r="${(1 + r() * 2).toFixed(1)}" fill="#fff" opacity=".8"/>`;
    const roof = (x, y, w) => poly([[x - w, y], [x + w, y], [x + w * 0.7, y - 36], [x - w * 0.7, y - 36]], '#2b3446') + poly([[x - w * 0.9, y - 36], [x + w * 0.9, y - 36], [x, y - 80]], '#39445a');
    let runes = '';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; runes += text((800 + Math.cos(a) * 190 - 8).toFixed(0), (790 + Math.sin(a) * 40 + 6).toFixed(0), 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[i], 22, '#ff5d5d', 'opacity=".85"'); }
    return `<defs>${lin('moSky', [[0, '#0a1424'], [1, '#2a3f5a']])}${lin('moGround', [[0, '#c7d6e6'], [1, '#6c7f96']])}${rad('moForge', [[0, '#ff7a2f', 0.8], [1, '#ff7a2f', 0]])}${rad('moRed', [[0, '#ff4d4d', 0.5], [1, '#ff4d4d', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#moSky)') + stars(r, 40, 0, 260, '#dff') +
      mountains(r, 520, 160, 360, '#223249', 200, '#e8f2ff') + mountains(r, 600, 80, 200, '#18283b', 140, '#cfe0f0') +
      poly([[0, 640], [W, 640], [W, H], [0, H]], 'url(#moGround)') +
      `<g>${rect(560, 420, 480, 220, '#1b2536')}${roof(800, 430, 340)}${roof(800, 340, 220)}${rect(740, 520, 120, 120, '#0c121c')}${rect(760, 540, 80, 100, '#ff7a2f', 'opacity=".75" class="flicker"')}${rect(590, 470, 30, 60, '#ff7a2f', 'opacity=".4" class="flicker"')}${rect(980, 470, 30, 60, '#ff7a2f', 'opacity=".4" class="flicker"')}</g>` +
      glow(800, 580, 280, 'moForge') +
      `<ellipse cx="800" cy="790" rx="250" ry="62" fill="#0e1520" stroke="#ff5d5d" stroke-width="5"/><ellipse cx="800" cy="790" rx="190" ry="40" fill="none" stroke="#ff5d5d" stroke-width="2" opacity=".6"/>` + glow(800, 790, 300, 'moRed', 'class="pulse"') + runes +
      [[200, 650], [1420, 650]].map(([x, y]) => rect(x - 6, y - 150, 12, 150, '#151d29') + poly([[x - 40, y - 150], [x + 40, y - 150], [x, y - 210]], '#2b3446')).join('') + snow + overlayVignette;
  },
};
