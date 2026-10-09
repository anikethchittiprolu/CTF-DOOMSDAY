// Small helpers for drawing the 2D region scenes as SVG strings (viewBox 1600 x 900).
export const W = 1600, H = 900;
export const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const f = (n) => Math.round(n * 10) / 10;

export const lin = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
export const rad = (id, stops) =>
  `<radialGradient id="${id}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

export const rect = (x, y, w, h, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`;
export const poly = (pts, fill, extra = '') => `<polygon points="${pts.map((p) => p.map(f).join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
export const circ = (x, y, r, fill, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
export const glow = (x, y, r, id, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${id})" ${extra}/>`;
export const text = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="ui-monospace,Menlo,Consolas,monospace" ${extra}>${s}</text>`;

export function stars(r, n, y0 = 0, y1 = 400, fill = '#cfe') {
  let o = '';
  for (let i = 0; i < n; i++) o += `<circle cx="${f(r() * W)}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(0.6 + r() * 1.4)}" fill="${fill}" opacity="${f(0.3 + r() * 0.7)}"/>`;
  return o;
}

/** Row of buildings. Returns shapes plus lit windows. */
export function skyline(r, baseY, hMin, hMax, fill, lit, { wMin = 40, wMax = 110, spire = false, winGap = 22 } = {}) {
  let o = '', x = -20;
  while (x < W) {
    const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin);
    o += rect(x, baseY - h, w, h + 400, fill);
    if (spire && r() > 0.7) o += poly([[x + w * 0.35, baseY - h], [x + w * 0.5, baseY - h - 70 - r() * 60], [x + w * 0.65, baseY - h]], fill);
    if (lit) {
      for (let wy = baseY - h + 14; wy < baseY - 10; wy += winGap) {
        for (let wx = x + 8; wx < x + w - 10; wx += 16) if (r() > 0.62) o += rect(wx, wy, 6, 9, lit, `opacity="${f(0.4 + r() * 0.6)}"`);
      }
    }
    x += w + r() * 8;
  }
  return o;
}

export function mountains(r, baseY, hMin, hMax, fill, step = 120, snow = null) {
  const pts = [[-10, baseY + 300]];
  const peaks = [];
  for (let x = -10; x <= W + 10; x += step) { const h = hMin + r() * (hMax - hMin); pts.push([x, baseY - h]); peaks.push([x, baseY - h]); pts.push([x + step / 2, baseY - h * (0.35 + r() * 0.3)]); }
  pts.push([W + 10, baseY + 300]);
  let o = poly(pts, fill);
  if (snow) peaks.forEach(([x, y]) => { o += poly([[x, y], [x - 26, y + 40], [x - 6, y + 34], [x + 8, y + 48], [x + 28, y + 38]], snow, 'opacity=".9"'); });
  return o;
}

export function monitor(x, y, w, h, color, id = 0) {
  return `<g class="flicker" style="animation-delay:${(id % 7) * 0.31}s">${rect(x, y, w, h, '#0a0d0c', 'rx="3"')}${rect(x + 3, y + 3, w - 6, h - 6, color, 'opacity=".55"')}` +
    `${rect(x + 6, y + h * 0.3, (w - 12) * 0.6, 3, '#fff', 'opacity=".5"')}${rect(x + 6, y + h * 0.5, (w - 12) * 0.8, 3, '#fff', 'opacity=".35"')}${rect(x + 6, y + h * 0.7, (w - 12) * 0.4, 3, '#fff', 'opacity=".4"')}</g>`;
}

/** A cheap humanoid silhouette (Doombot-like). */
export function bot(x, y, s, fill, eye = '#3ddc84', extra = '') {
  return `<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${rect(-14, -60, 28, 30, fill, 'rx="4"')}${rect(-8, -52, 16, 8, '#05080a', 'rx="2"')}` +
    `${rect(-6, -50, 4, 3, eye)}${rect(2, -50, 4, 3, eye)}${rect(-22, -28, 44, 46, fill, 'rx="5"')}${rect(-30, -26, 9, 40, fill)}${rect(21, -26, 9, 40, fill)}${rect(-16, 18, 12, 38, fill)}${rect(4, 18, 12, 38, fill)}</g>`;
}

export const defsCommon = `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>`;
export const vignette = `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>` ;
export const overlayVignette = `<rect width="${W}" height="${H}" fill="url(#vig)" pointer-events="none"/>`;
