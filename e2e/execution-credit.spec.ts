import { expect, test } from '@playwright/test';

test('nonchampion final blow credits the recent attacker in the gold and kill HUD', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const victim = w.spawn('champion', 'red', { x: w.hero.x + 250, y: w.hero.y });
    const turret = w.spawn('turret', 'blue', { x: victim.x + 250, y: victim.y });
    w.damage(w.hero, victim, 1, 'true');
    w.damage(turret, victim, 10000, 'true');
    g.hud.update(60);
  });
  await expect(page.locator('#gold')).toHaveText('900');
  await expect(page.locator('#personal')).toHaveText('1 / 0 / 0');
  await expect(page.locator('#kills')).toHaveText('1');
  expect(errors).toEqual([]);
});
