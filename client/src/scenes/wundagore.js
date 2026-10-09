import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, mountains, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'wundagore',
  palette: { bg: '#0f0a1a', accent: '#6df0d2' },
  props: ['Stair', 'Stair', 'Stair', 'Rock', 'Rock', 'Rock', 'Peak', 'Peak', 'Cave', 'Cave', 'Cave', 'Spire', 'Spire', 'Stone', 'Stone'],
  slots: [[330, 760], [460, 690], [590, 620], [180, 520], [1240, 560], [1380, 470], [800, 300], [900, 230], [220, 330], [1360, 720], [1180, 790], [1040, 380], [660, 440], [520, 330], [1470, 330]],
  svg() {
    const r = rng(79);
    let stair = '', x = 250, y = 800;
    for (let i = 0; i < 9; i++) { stair += poly([[x, y], [x + 80, y - 26], [x + 150, y - 26], [x + 70, y]], i % 2 ? '#3a2a5a' : '#4a3570') + poly([[x, y], [x + 70, y], [x + 70, y + 24], [x, y + 24]], '#221838'); x += 66; y -= 34; }
    let rocks = '';
    for (let i = 0; i < 10; i++) rocks += `<g class="drift" style="animation-delay:${(i * 0.9).toFixed(1)}s">${poly([[0, 0], [40 + r() * 30, -10], [60 + r() * 20, 30], [20, 44]].map(([a, b]) => [a + 100 + r() * 1300 * 0 + i * 140, b + 120 + (i % 4) * 90]), '#2d2145')}</g>`;
    let slices = '';
    for (let i = 0; i < 6; i++) slices += rect(0, 120 + i * 120, W, 10, '#6df0d2', `class="glitch" opacity=".12" style="animation-delay:${(i * 0.5).toFixed(1)}s"`);
    return `<defs>${lin('wuSky', [[0, '#120a22'], [0.6, '#2a1a4a'], [1, '#0e3a44']])}${rad('wuGlow', [[0, '#6df0d2', 0.5], [1, '#6df0d2', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#wuSky)') + stars(r, 50, 0, 500, '#bff') + glow(800, 250, 320, 'wuGlow', 'class="pulse"') +
      mountains(r, 640, 220, 520, '#1b1232', 130) + mountains(r, 760, 120, 300, '#2a1c48', 100) + rect(0, 800, W, 100, '#120a22') +
      poly([[760, 120], [800, 40], [840, 120], [830, 330], [770, 330]], '#3a2a5a') + glow(800, 60, 80, 'wuGlow') +
      stair + rocks + slices + `<path d="M1180 560 q40 -80 80 0 q40 80 80 0" stroke="#6df0d2" stroke-width="3" fill="none" opacity=".6"/>` + overlayVignette;
  },
};
