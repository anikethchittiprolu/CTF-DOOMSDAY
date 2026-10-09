import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, skyline, monitor, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'embassy',
  palette: { bg: '#140e0a', accent: '#e0a63a' },
  props: ['Screen', 'Screen', 'Screen', 'Screen', 'Folder', 'Folder', 'Folder', 'Map table', 'Map table', 'Pouch', 'Pouch', 'Safe', 'Safe', 'Desk', 'Desk'],
  slots: [[270, 250], [450, 250], [630, 250], [810, 250], [260, 640], [350, 700], [190, 710], [800, 640], [720, 700], [880, 700], [1180, 660], [1260, 720], [1100, 720], [1420, 640], [1480, 720]],
  svg() {
    const r = rng(23);
    let mons = '';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) mons += monitor(140 + col * 112, 110 + row * 104, 100, 92, ['#4aa3ff', '#3ddc84', '#e0a63a'][(row + col) % 3], row * 7 + col);
    return `<defs>${lin('emWall', [[0, '#26180f'], [1, '#150e09']])}${lin('emNight', [[0, '#0b1020'], [1, '#2a2438']])}${lin('emFloor', [[0, '#2a1b10'], [1, '#0e0905']])}${rad('emLamp', [[0, '#ffb347', 0.5], [1, '#ffb347', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#emWall)') +
      rect(1000, 120, 400, 380, '#050810') + rect(1008, 128, 384, 364, 'url(#emNight)') + skyline(r, 470, 60, 190, '#0a0d18', '#ffd479', { wMin: 30, wMax: 70, winGap: 16 }) +
      rect(1000, 120, 400, 6, '#3a2616') + rect(1000, 494, 400, 8, '#3a2616') + rect(1196, 120, 8, 380, '#3a2616') + rect(1000, 120, 8, 380, '#3a2616') + rect(1392, 120, 8, 380, '#3a2616') +
      rect(120, 90, 800, 336, '#0a0806', 'rx="6"') + mons +
      poly([[0, 560], [W, 560], [W, H], [0, H]], 'url(#emFloor)') +
      `<g>${poly([[540, 700], [1060, 700], [1000, 620], [600, 620]], '#4a301c')}${rect(560, 700, 480, 22, '#33200f')}${rect(600, 720, 14, 60, '#33200f')}${rect(986, 720, 14, 60, '#33200f')}` +
      poly([[640, 650], [960, 650], [930, 630], [670, 630]], '#c9b88a', 'opacity=".6"') + circ(740, 640, 5, '#ff4d4d') + circ(810, 645, 5, '#4aa3ff') + circ(880, 638, 5, '#111') + circ(780, 655, 5, '#ff4d4d') + `</g>` +
      [[190, 700], [260, 710], [350, 700]].map(([x, y]) => rect(x, y, 70, 46, '#c8a86a') + rect(x, y, 70, 8, '#a98848')).join('') +
      rect(1120, 640, 220, 24, '#3a2616') + rect(1130, 664, 14, 100, '#2a1a0f') + rect(1316, 664, 14, 100, '#2a1a0f') + rect(1140, 610, 60, 30, '#050708') + rect(1146, 614, 48, 22, '#4aa3ff', 'opacity=".5" class="flicker"') +
      rect(1400, 580, 120, 190, '#1c2224') + circ(1460, 660, 26, '#2c3638') + circ(1460, 660, 8, '#e0a63a') +
      glow(300, 560, 260, 'emLamp') + glow(1300, 520, 200, 'emLamp') +
      text(150, 460, 'LATVERIAN MISSION . NEW YORK', 18, '#e0a63a', 'opacity=".7"') + overlayVignette;
  },
};
