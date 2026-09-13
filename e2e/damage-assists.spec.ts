import { expect, test } from '@playwright/test';

test('damage assist appears in personal score and the held scoreboard', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const human = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
    const killer = w.spawn('champion', 'blue', { x: 0, y: 0 });
    victim.ai = killer.ai = false;
    w.damage(w.hero, victim, 1, 'true');
    w.damage(killer, victim, 10000, 'true');
    g.hud.update(60);
    g.setPaused(false);
    return w.hero.id;
  });
  await expect(page.locator('#personal')).toHaveText('0 / 0 / 1');
  await expect(page.locator('#kills')).toHaveText('1');
  await page.keyboard.down('Tab');
  await expect(page.locator(`[data-champion="${human}"] .scoreboard-kda`)).toHaveText('0 / 0 / 1');
  await page.keyboard.up('Tab');
});
