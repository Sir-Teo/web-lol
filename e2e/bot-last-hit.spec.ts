import { expect, test } from '@playwright/test';

test('bot secures a visible last hit beyond a nearer healthy minion', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    w.hero.x = -3500;
    w.hero.y = -3000;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
    const healthy = w.spawn('melee', 'blue', { x: 200, y: 0 });
    const weak = w.spawn('caster', 'blue', { x: 500, y: 0 });
    healthy.speed = weak.speed = 0;
    healthy.nextAttackTick = weak.nextAttackTick = w.tick + 10000;
    weak.hp = 20;
    bot.ai = true;
    const gold = w.championState(bot.id).gold;
    w.step();
    const choseWeak = bot.attackTarget === weak.id;
    w.step(55);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      choseWeak,
      killed: weak.hp === 0,
      healthyUntouched: healthy.hp === healthy.maxHp,
      cs: w.championState(bot.id).cs,
      earned: w.championState(bot.id).gold > gold,
    };
  });
  expect(result).toEqual({
    choseWeak: true,
    killed: true,
    healthyUntouched: true,
    cs: 1,
    earned: true,
  });
  expect(errors).toEqual([]);
});
