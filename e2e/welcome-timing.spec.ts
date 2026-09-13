import { expect, test } from '@playwright/test';

test('welcome announcement follows match time and freezes through pause', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const seek = async (tick: number) => {
    await page.evaluate((tick) => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      g.world.tick = tick;
      g.hud.update(60);
    }, tick);
    return page.locator('.welcome').evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, visibility: style.visibility, filter: style.filter };
    });
  };
  const start = await seek(0);
  expect(Number(start.opacity)).toBe(0);
  const shown = await seek(120);
  expect(Number(shown.opacity)).toBe(1);
  expect(shown.visibility).toBe('visible');
  await page.waitForTimeout(300);
  expect(await seek(120)).toEqual(shown);
  const fading = await seek(420);
  expect(Number(fading.opacity)).toBeGreaterThan(0);
  expect(Number(fading.opacity)).toBeLessThan(1);
  const ended = await seek(480);
  expect(ended.visibility).toBe('hidden');
  expect(Number(ended.opacity)).toBe(0);
  expect(await seek(90 * 60)).toEqual(ended);
});

test('reduced-motion welcome uses its shorter match-time duration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.tick = 60;
    g.hud.update(60);
  });
  await expect(page.locator('.welcome')).toHaveCSS('visibility', 'hidden');
});
