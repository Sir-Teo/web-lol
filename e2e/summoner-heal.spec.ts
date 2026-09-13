import { expect, test } from '@playwright/test';

test('F heals while stunned and updates cooldown without allowing Volley', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { hp: 10, x: 0, y: 0, stunUntil: Infinity });
    g.view.recenter(w.hero);
  });
  await page.keyboard.press('w');
  await page.keyboard.press('f');
  await expect(page.locator('[data-ability="f"]')).toHaveClass(/cooling/);
  await expect(page.locator('[data-ability="w"]')).not.toHaveClass(/cooling/);
  const result = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      heals: w.events.filter((e: any) => e.type === 'heal').map((e: any) => e.value),
      stunned: w.hero.stunUntil > w.tick,
      x: w.hero.x,
      y: w.hero.y,
    };
  });
  expect(result).toEqual({ heals: [80], stunned: true, x: 0, y: 0 });
});
