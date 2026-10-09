import { W, H, rng, lin, rad, rect, poly, circ, glow, text, stars, defsCommon, vignette, overlayVignette } from './kit.js';

export default {
  id: 'timeplatform',
  palette: { bg: '#060a1a', accent: '#f4d03f' },
  props: ['Clock', 'Clock', 'Clock', 'Debris', 'Debris', 'Debris', 'Gear', 'Gear', 'Gear', 'Dial', 'Dial', 'Loop', 'Loop', 'Rail', 'Rail'],
  slots: [[800, 270], [640, 360], [960, 360], [330, 280], [260, 460], [1350, 300], [1420, 470], [500, 540], [1100, 540], [330, 660], [1270, 660], [800, 640], [700, 730], [900, 730], [800, 520]],
  svg() {
    const r = rng(91);
    let ticks = '';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; ticks += `<line x1="${(800 + Math.cos(a) * 240).toFixed(1)}" y1="${(380 + Math.sin(a) * 240).toFixed(1)}" x2="${(800 + Math.cos(a) * 270).toFixed(1)}" y2="${(380 + Math.sin(a) * 270).toFixed(1)}" stroke="#f4d03f" stroke-width="${i % 3 ? 4 : 9}"/>`; }
    let debris = '';
    for (let i = 0; i < 18; i++) debris += `<g class="drift" style="animation-delay:${(i * 0.6).toFixed(1)}s;animation-duration:${(10 + r() * 8).toFixed(0)}s">${poly([[0, 0], [14 + r() * 26, 4], [20 + r() * 20, 22], [4, 18]].map(([a, b]) => [a + r() * W, b + 80 + r() * 640]), '#3a4268', 'opacity=".8"')}</g>`;
    return `<defs>${lin('tpSky', [[0, '#03050f'], [1, '#101c40']])}${rad('tpGlow', [[0, '#f4d03f', 0.4], [1, '#f4d03f', 0]])}${rad('tpPlat', [[0, '#7aa8ff', 0.4], [1, '#7aa8ff', 0]])}${defsCommon}${vignette}</defs>` +
      rect(0, 0, W, H, 'url(#tpSky)') + stars(r, 120, 0, H, '#cfe') + glow(800, 380, 420, 'tpGlow') + debris +
      `<circle cx="800" cy="380" r="285" fill="#0a1024" stroke="#f4d03f" stroke-width="12"/>${ticks}` +
      `<line x1="800" y1="380" x2="800" y2="190" stroke="#f4d03f" stroke-width="10" class="spin" style="transform-origin:800px 380px;animation-duration:60s"/><line x1="800" y1="380" x2="890" y2="440" stroke="#f4d03f" stroke-width="14"/>` +
      `<path d="M690 230 L760 330 L720 380 L800 440 L760 520" stroke="#050810" stroke-width="7" fill="none"/><path d="M1000 300 L930 380 L960 430" stroke="#050810" stroke-width="5" fill="none"/>` +
      `<ellipse cx="800" cy="700" rx="520" ry="90" fill="#0d1530" stroke="#7aa8ff" stroke-width="10"/><ellipse cx="800" cy="700" rx="430" ry="62" fill="none" stroke="#7aa8ff" stroke-width="3" opacity=".6"/>` + glow(800, 700, 520, 'tpPlat') +
      `<g class="spin" style="transform-origin:330px 280px;animation-duration:24s">${circ(330, 280, 46, 'none', 'stroke="#f4d03f" stroke-width="10" stroke-dasharray="16 10"')}</g>` +
      `<g class="spin" style="transform-origin:1350px 300px;animation-duration:36s">${circ(1350, 300, 60, 'none', 'stroke="#7aa8ff" stroke-width="10" stroke-dasharray="20 12"')}</g>` +
      text(560, 840, 'TIME VARIANCE AUTHORITY . PLATFORM', 20, '#7aa8ff', 'opacity=".6"') + overlayVignette;
  },
};
