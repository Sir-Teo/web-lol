import { expect, test } from '@playwright/test';

test('level-18 champion bounty reaches the player gold HUD', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
    victim.ai = false;
    w.gainExperience(1e6, victim.id);
    w.damage(w.hero, victim, 10000, 'true');
    g.hud.update(60);
  });
  await expect(page.locator('#gold')).toHaveText('920');
  await expect(page.locator('#personal')).toHaveText('1 / 0 / 0');
});
