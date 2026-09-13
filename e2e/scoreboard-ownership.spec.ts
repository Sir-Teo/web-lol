import { expect, test } from '@playwright/test';

test('scoreboard and team totals use champion records and update while held open', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
    bot.ai = false;
    const killer = w.spawn('melee', 'red', { x: 0, y: 0 });
    w.damage(killer, w.hero, 10000, 'true');
    for (let i = 0; i < 2; i++) {
      const ally = w.spawn('champion', 'blue', { x: 0, y: 0 });
      w.damage(bot, ally, 10000, 'true');
    }
    w.damage(w.spawn('melee', 'blue', { x: 0, y: 0 }), bot, 10000, 'true');
    w.championState(bot.id).cs = 7;
    bot.name = '<b>Enemy Ashe</b>';
    g.hud.update(60);
    g.setPaused(false);
    return { human: w.hero.id, bot: bot.id };
  });
  await page.keyboard.down('Tab');
  await expect(page.locator('.scoreboard-row')).toHaveCount(4);
  await expect(page.locator(`[data-champion="${ids.human}"] .scoreboard-kda`)).toHaveText(
    '0 / 1 / 0'
  );
  const enemy = page.locator(`[data-champion="${ids.bot}"]`);
  await expect(enemy.locator('.scoreboard-kda')).toHaveText('2 / 1 / 0');
  await expect(enemy.locator('.scoreboard-cs')).toHaveText('7 CS');
  await expect(enemy.locator('strong')).toContainText('<b>Enemy Ashe</b>');
  await expect(enemy.locator('strong b')).toHaveCount(0);
  await expect(page.locator('#kills')).toHaveText('0');
  await expect(page.locator('#deaths')).toHaveText('2');
  await expect(page.locator('#personal')).toHaveText('0 / 1 / 0');
  await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.world.championState(id).cs++;
    g.hud.update(60);
  }, ids.bot);
  await expect(enemy.locator('.scoreboard-cs')).toHaveText('8 CS');
  await page.screenshot({ path: 'artifacts/scoreboard-ownership.png' });
  await page.keyboard.up('Tab');
  await expect(page.locator('.scoreboard')).toBeHidden();
});
