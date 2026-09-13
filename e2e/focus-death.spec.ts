import { expect, test } from '@playwright/test';

test('death immediately clears Focus pips and the active Q indicator', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.qStacks = 4;
    g.world.player.qStackExpiry = g.world.tick + 240;
    g.world.player.qUntil = g.world.tick + 240;
  });
  await expect(page.locator('.focus-pips .charged')).toHaveCount(4);
  await expect(page.locator('[data-ability="q"]')).toHaveClass(/empowered/);
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const killer = w.spawn('dummy', 'red', { x: 0, y: 0 });
    w.damage(killer, w.hero, 1e6, 'true');
  });
  await expect(page.locator('.death-overlay')).toBeVisible();
  await expect(page.locator('.focus-pips .charged')).toHaveCount(0);
  await expect(page.locator('[data-ability="q"]')).not.toHaveClass(/empowered/);
});
