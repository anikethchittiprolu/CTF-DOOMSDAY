import { test, expect } from '@playwright/test';
import { watch, url, ready } from './helpers.js';

const REGIONS = ['doomstadt', 'embassy', 'foundry', 'archives', 'haasenstadt', 'monastery', 'wundagore', 'baxter', 'timeplatform', 'citadel'];

test('every region scene loads with its hotspot and passes the 6 second rule', async ({ page }) => {
  const bad = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url('mode=flat'));
  await ready(page);
  for (const id of REGIONS) {
    const t = Date.now();
    await page.click(`.map-label[data-region="${id}"]`);
    await page.waitForSelector(`.scene[data-region="${id}"] .hot`);
    expect(Date.now() - t).toBeLessThan(6000);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `output/scene-${id}.png` });
    await page.click('#btn-back');
    await page.waitForSelector('.map-label');
  }
  expect(bad).toEqual([]);
});

test('lite mode has no canvas or illustration but the same challenges', async ({ page }) => {
  const bad = watch(page);
  await page.goto(url('mode=lite'));
  await ready(page);
  expect(await page.locator('canvas, svg[viewBox="0 0 1600 900"]').count()).toBe(0);
  expect(await page.locator('.lite .ch').count()).toBe(10);
  await page.screenshot({ path: 'output/lite.png' });
  expect(bad).toEqual([]);
});
