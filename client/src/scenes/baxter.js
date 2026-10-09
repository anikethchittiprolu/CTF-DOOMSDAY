import { W, H, rng, lin, rad, rect, poly, circ, glow, text, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'baxter',
  palette: { bg: '#1c2a40', accent: '#4aa3ff' },
  props: ['Board', 'Board', 'Board', 'Monitor', 'Monitor', 'Gadget', 'Gadget', 'Gadget', 'Car', 'Car', 'Bench', 'Bench', 'Console', 'Console', 'Shelf'],
  slots: [[330, 300], [450, 360], [570, 300], [1180, 360], [1270, 420], [260, 700], [360, 740], [160, 740], [800, 700], [900, 750], [1100, 700], [1250, 740], [700, 460], [1420, 640], [1460, 330]],
  svg() {
    const chalk = ['E = mc²', '∇·B = 0', 'Σ 1/n²', 'ψ(x,t)', 'a² + b² = c²', 'dS ≥ 0', 'π ≈ 3.14159'];
    return `<defs>${lin('baWall', [[0, '#f2e6c8'], [1, '#d9c9a0']])}${lin('baChrome', [[0, '#ffffff'], [0.5, '#9fb2c2'], [1, '#5a6a78']])}${lin('baFloor', [[0, '#e5d7b2'], [1, '#b9a67a']])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#baWall)') + rect(0, 0, W, 60, '#2d5bd7') + rect(0, 60, W, 14, '#e8452c') + rect(0, 74, W, 8, '#f6c431') +
      rect(240, 160, 440, 300, '#3a2a1a') + rect(252, 172, 416, 276, '#1f3a2c') + chalk.map((t, i) => text(280 + (i % 2) * 190, 230 + i * 34, t, 24, '#e8f4ea', 'opacity=".85"')).join('') +
      `<path d="M280 420 q80 -40 160 0 t160 0" stroke="#e8f4ea" stroke-width="3" fill="none" opacity=".7"/>` +
      rect(1040, 160, 330, 260, '#2d5bd7') + rect(1056, 176, 298, 228, '#071322') + rect(1070, 190, 270, 200, '#4aa3ff', 'opacity=".35" class="flicker"') + circ(1205, 290, 52, 'none', 'stroke="#fff" stroke-width="5" opacity=".7"') + text(1190, 300, '4', 56, '#fff', 'opacity=".8"') +
      poly([[0, 620], [W, 620], [W, H], [0, H]], 'url(#baFloor)') +
      [[200, 700], [330, 730]].map(([x, y]) => rect(x, y - 70, 90, 70, 'url(#baChrome)', 'rx="12"') + circ(x + 25, y - 36, 12, '#e8452c') + circ(x + 62, y - 36, 12, '#f6c431')).join('') +
      `<g>${poly([[640, 740], [960, 740], [1000, 700], [940, 660], [700, 660], [640, 700]], '#2d5bd7')}${poly([[720, 660], [920, 660], [880, 620], [760, 620]], '#9fd6ff')}${circ(720, 750, 32, '#222')}${circ(900, 750, 32, '#222')}${circ(720, 750, 14, 'url(#baChrome)')}${circ(900, 750, 14, 'url(#baChrome)')}</g>` +
      rect(1050, 690, 260, 24, '#2d5bd7') + rect(1060, 714, 14, 60, '#1c3f9c') + rect(1286, 714, 14, 60, '#1c3f9c') + rect(1120, 610, 80, 80, 'url(#baChrome)', 'rx="8"') + rect(1130, 620, 60, 40, '#f6c431', 'class="flicker"') +
      rect(1380, 560, 160, 200, '#e8452c') + [0, 1, 2].map((i) => circ(1420 + i * 40, 610, 12, '#fff', 'class="pulse"')).join('') +
      rect(1360, 300, 200, 18, '#2d5bd7') + [0, 1, 2, 3].map((i) => rect(1370 + i * 46, 250, 36, 50, ['#e8452c', '#f6c431', '#2d5bd7', '#4aa3ff'][i])).join('') + overlayVignette;
  },
};
