import { expect, test } from '@playwright/test';

test('an actual champion kill awards source XP and a level-up skill point', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const screen = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    w.player.xp = 250;
    const victim = w.spawn('champion', 'red', { x: w.hero.x + 250, y: w.hero.y });
    victim.ai = false;
    victim.hp = 1;
    return g.view.screenPoint(victim, 0.65);
  });
  await page.mouse.click(screen.x, screen.y, { button: 'right' });
  await expect(page.locator('#level')).toHaveText('2');
  const result = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { xp: w.player.xp, points: w.player.skillPoints, kills: w.player.kills };
  });
  expect(result).toEqual({ xp: 12, points: 1, kills: 1 });
  expect(errors).toEqual([]);
});
