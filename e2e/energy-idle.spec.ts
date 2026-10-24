import { expect, test } from '@playwright/test';

test('paused and hidden matches sleep, repaint on resize, and resume without catch-up', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    (window as any).__energyRenders = 0;
    const render = g.view.render;
    g.view.render = function (...args: any[]) {
      (window as any).__energyRenders++;
      return render.apply(this, args);
    };
  });
  const tick = await page.evaluate(() => (window as any).__GAME__.world.tick);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__energyRenders)).toBe(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => page.evaluate(() => (window as any).__energyRenders)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    (window as any).__energyRenders = 0;
  });
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(() => ({
      frames: (window as any).__energyRenders,
      tick: (window as any).__GAME__.world.tick,
    }))
  ).toEqual({ frames: 0, tick });
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => (window as any).__energyRenders)).toBe(1);
  expect(await page.evaluate(() => (window as any).__GAME__.hud.paused)).toBe(true);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__energyRenders)).toBe(1);
  await page.evaluate(() => (window as any).__GAME__.hud.closeModal());
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.tick))
    .toBeGreaterThan(tick + 10);
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  const advanced = await page.evaluate((tick) => (window as any).__GAME__.world.tick - tick, tick);
  expect(advanced).toBeLessThan(80);
});
