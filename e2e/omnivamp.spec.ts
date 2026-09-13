import { expect, test } from '@playwright/test';
test('Doran damage healing updates the health HUD', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.buy('blade');
    w.hero.hp = 100;
    const target = w.spawn('champion', 'red', { x: 0, y: 0 });
    w.damage(w.hero, target, 200, 'true');
    g.hud.update(60);
  });
  await expect(page.locator('#health-text')).toHaveText('105 / 690');
});
