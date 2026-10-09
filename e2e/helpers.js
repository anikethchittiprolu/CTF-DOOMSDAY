export function watch(page, allow = []) {
  const bad = [];
  page.on('pageerror', (e) => bad.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type())) return;
    const t = m.text();
    if (allow.some((a) => t.includes(a))) return;
    bad.push(`${m.type()}: ${t}`);
  });
  return bad;
}
export const url = (q = '') => `/?noboot=1&nobroadcast=1&reset=1&${q}`;
export async function ready(page) { await page.waitForSelector('#hud'); await page.waitForSelector('.map-label, .lite .region', { timeout: 20000 }); }
export const hour = (page, h) => page.evaluate((x) => { window.__mock.setHour(x); }, h);
