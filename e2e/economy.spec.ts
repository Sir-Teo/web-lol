import { expect, test } from '@playwright/test';

test('HUD and shop show whole spendable gold while purchases preserve the fractional balance', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 500.578;
    g.hud.update(60);
  });
  await expect(page.locator('#gold')).toHaveText('500');
  await page.locator('#shop-button').click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 500');
  await page.locator('[data-buy="blade"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 50');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.gold)).toBeCloseTo(50.578);
  await expect(page.locator('#gold')).toHaveText('50');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.units = [g.world.hero];
    g.world.nextWaveTick = Infinity;
    g.world.tick = 65 * 60;
    g.world.step(300);
    g.hud.update(60);
  });
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 60');
  await expect(page.locator('#gold')).toHaveText('60');
});
