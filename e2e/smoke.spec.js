import { test, expect } from '@playwright/test';

// Collect anything that would show up as a console error or page crash.
function watch(page) {
  const bad = [];
  page.on('pageerror', (e) => bad.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) bad.push(`${m.type()}: ${m.text()}`); });
  return bad;
}

test('boots in flat mode, shows the map and the HUD', async ({ page }) => {
  const bad = watch(page);
  await page.goto('/?mode=flat&noboot=1&nobroadcast=1&reset=1');
  
  await page.waitForSelector('.map-label');
  expect(await page.locator('.map-label').count()).toBe(10);
  await page.screenshot({ path: 'output/smoke-flat.png' });
  expect(bad).toEqual([]);
});
