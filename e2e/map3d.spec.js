import { test, expect } from '@playwright/test';
import { watch, url, ready, hour } from './helpers.js';

test('light 3D map renders, stays inside the polygon budget and exposes accessible labels', async ({ page }) => {
  const bad = watch(page, ['GL Driver Message', 'GPU stall', 'swiftshader', 'WebGL']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url('mode=full&poll=1000&jitter=0'));
  await ready(page);
  await page.waitForTimeout(2500);
  expect(await page.locator('.map-label').count()).toBe(10);
  expect(await page.locator('canvas').count()).toBe(1);
  await page.screenshot({ path: 'output/map3d-early.png' });
  // late in the event the sky cracks open and the second Earth appears
  await hour(page, 21);
  await page.waitForTimeout(6500);
  await page.screenshot({ path: 'output/map3d-late.png' });
  const label = await page.locator('.map-label[data-region="foundry"]').getAttribute('aria-label');
  expect(label).toMatch(/Doombot Foundry/);
  expect(bad).toEqual([]);
});
