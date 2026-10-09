import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, skyline, monitor, defsCommon, vignette, overlayVignette } from './kit.js';

const cluster = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${rect(-70, 10, 140, 18, '#0b1410')}${rect(-60, -40, 40, 50, '#10201a')}${rect(-56, -34, 32, 34, '#3ddc84', 'opacity=".5" class="flicker"')}` +
  `${rect(-15, -50, 44, 60, '#10201a')}${rect(-11, -44, 36, 42, '#3ddc84', 'opacity=".65" class="flicker" style="animation-delay:.4s"')}${rect(34, -30, 36, 40, '#10201a')}${rect(38, -26, 28, 28, '#3ddc84', 'opacity=".4" class="flicker" style="animation-delay:.9s"')}</g>`;

export default {
  id: 'doomstadt',
  palette: { bg: '#06100c', accent: '#3ddc84' },
  props: ['Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Plinth', 'Plinth', 'Plinth'],
  slots: [[260, 690], [345, 735], [190, 745], [490, 585], [555, 622], [425, 625], [1340, 690], [1265, 735], [1410, 745], [1110, 585], [1045, 622], [1175, 625], [800, 690], [705, 745], [895, 745]],
  svg() {
    const r = rng(11);
    return `<defs>${lin('dsSky', [[0, '#040a08'], [0.6, '#0b2418'], [1, '#14402c']])}${rad('dsHalo', [[0, '#3ddc84', 0.55], [1, '#3ddc84', 0]])}${lin('dsFloor', [[0, '#17231d'], [1, '#080d0b']])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#dsSky)') + stars(r, 60, 0, 260, '#bfe') +
      `<ellipse cx="800" cy="330" rx="620" ry="150" fill="#3ddc84" opacity=".08"/>` +
      skyline(r, 520, 90, 230, '#0a1712', '#3ddc84', { spire: true }) + skyline(r, 560, 130, 330, '#0e2119', '#9bf5c4', { wMin: 60, wMax: 130, spire: true }) +
      `<g>${poly([[640, 640], [960, 640], [1010, 590], [590, 590]], '#18291f')}${rect(600, 590, 400, 14, '#22372b')}${rect(660, 560, 280, 34, '#2a4234')}` +
      poly([[740, 560], [860, 560], [900, 300], [700, 300]], '#16221c') +
      poly([[700, 300], [900, 300], [980, 470], [820, 400], [780, 400], [620, 470]], '#0e1713') +
      rect(755, 210, 90, 100, '#2a3a32', 'rx="12"') + rect(768, 236, 64, 40, '#05080a', 'rx="6"') + rect(778, 248, 14, 8, '#3ddc84', 'class="pulse"') + rect(808, 248, 14, 8, '#3ddc84', 'class="pulse"') +
      glow(800, 252, 90, 'dsHalo') + `</g>` +
      poly([[0, 600], [W, 600], [W, H], [0, H]], 'url(#dsFloor)') +
      [160, 300, 480, 800, 1120, 1300, 1440].map((x, i) => `<path d="M${x} 600 L${x - 120 + i * 40} ${H}" stroke="#2c4437" stroke-width="2" opacity=".35"/>`).join('') +
      cluster(260, 720, 1.1) + cluster(1340, 720, 1.1) + cluster(490, 610, 0.8) + cluster(1110, 610, 0.8) +
      [90, 1510].map((x) => rect(x - 4, 420, 8, 260, '#101a15') + glow(x, 420, 70, 'dsHalo')).join('') +
      text(220, 520, 'PETITIONS', 20, '#3ddc84', 'opacity=".8" class="flicker"') + text(1260, 520, 'STATE BANK', 20, '#3ddc84', 'opacity=".8" class="flicker"') +
      text(70, 380, 'BORDER POST', 18, '#7fe6b0', 'opacity=".6"') + text(1380, 380, 'TREASURY', 18, '#7fe6b0', 'opacity=".6"') + overlayVignette;
  },
};
