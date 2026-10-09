import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, bot, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'foundry',
  palette: { bg: '#140806', accent: '#ff7a2f' },
  props: ['Line', 'Line', 'Line', 'Bot', 'Bot', 'Bot', 'Cabinet', 'Cabinet', 'Cabinet', 'Channel', 'Channel', 'Port', 'Port', 'Gate', 'Prime'],
  slots: [[200, 640], [330, 690], [460, 640], [600, 600], [700, 680], [800, 600], [1100, 340], [1180, 420], [1260, 340], [330, 800], [560, 810], [940, 640], [1030, 700], [1330, 700], [800, 440]],
  svg() {
    const r = rng(37);
    let sparks = '';
    for (let i = 0; i < 26; i++) sparks += `<circle class="ember" style="animation-delay:${(r() * 5).toFixed(2)}s;animation-duration:${(3 + r() * 3).toFixed(1)}s" cx="${(300 + r() * 1000).toFixed(0)}" cy="${(700 + r() * 140).toFixed(0)}" r="${(1.5 + r() * 2.5).toFixed(1)}" fill="#ff9f43"/>`;
    return `<defs>${lin('foSky', [[0, '#1b0c08'], [1, '#33140b']])}${lin('foFloor', [[0, '#241410'], [1, '#0a0605']])}${rad('foGlow', [[0, '#ff7a2f', 0.7], [1, '#ff7a2f', 0]])}${lin('foMetal', [[0, '#3a3a3c'], [1, '#161617']])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#foSky)') +
      [120, 380, 760, 1180, 1480].map((x, i) => rect(x, 0, 36 + (i % 2) * 20, 180 + (i * 37) % 120, '#0f0807')).join('') +
      rect(0, 180, W, 24, 'url(#foMetal)') + rect(0, 218, W, 10, '#1d1d1f') +
      [200, 500, 800, 1100, 1400].map((x) => poly([[x, 204], [x + 40, 204], [x + 30, 330], [x + 10, 330]], '#1d1d1f')).join('') +
      poly([[0, 560], [W, 560], [W, H], [0, H]], 'url(#foFloor)') +
      `<g>${rect(120, 650, 760, 30, '#111')}${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => rect(130 + i * 44, 654, 30, 22, '#272728')).join('')}${rect(120, 676, 760, 8, '#ff7a2f', 'opacity=".5"')}</g>` +
      bot(210, 650, 1.05, '#2c2c2e', '#ff7a2f') + bot(360, 650, 1.05, '#2c2c2e', '#ff7a2f') + bot(520, 650, 1.05, '#242426', '#555') + bot(690, 650, 1.05, '#202022', '#222') + bot(820, 650, 1.05, '#2c2c2e', '#ff7a2f') +
      `<path d="M0 810 L420 780 L420 840 L860 800 L1100 850 L1600 820" stroke="#ff5a1a" stroke-width="22" fill="none" class="pulse"/><path d="M0 810 L420 780 L420 840 L860 800 L1100 850 L1600 820" stroke="#ffd479" stroke-width="7" fill="none" opacity=".8"/>` +
      glow(700, 810, 360, 'foGlow') +
      [0, 1, 2].map((i) => `<g>${rect(1080 + i * 110, 280, 96, 190, '#202224')}${rect(1090 + i * 110, 296, 76, 54, '#071009')}${rect(1096 + i * 110, 302, 64, 42, '#3ddc84', 'opacity=".55" class="flicker"')}${[0, 1, 2, 3].map((k) => circ(1100 + i * 110 + k * 18, 380, 5, ['#3ddc84', '#ff7a2f', '#ff4d4d', '#3ddc84'][(k + i) % 4], 'class="pulse"')).join('')}</g>`).join('') +
      bot(800, 480, 2.3, '#1c1c1e', '#ff4d4d', 'class="pulse"') + bot(1330, 720, 1.25, '#2c2c2e', '#ff7a2f') +
      sparks + text(130, 620, 'LINE ONE . NINE MINUTES', 18, '#ff7a2f', 'opacity=".75"') + overlayVignette;
  },
};
