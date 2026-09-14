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

test('bot takes another last hit when an allied caster missile will claim the first', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.hero.x = -3500;
    w.hero.y = -3000;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
    bot.ai = false;
    const claimed = w.spawn('caster', 'blue', { x: 500, y: 0 });
    const available = w.spawn('melee', 'blue', { x: 200, y: 0 });
    const ally = w.spawn('caster', 'red', { x: 300, y: 0 });
    claimed.hp = 20;
    claimed.goldBounty = 90;
    available.hp = 25;
    claimed.speed = available.speed = ally.speed = 0;
    claimed.nextAttackTick = available.nextAttackTick = w.tick + 10000;
    ally.damage = 50;
    w.setOrder(ally, { type: 'attack', target: claimed.id });
    w.step();
    w.step(ally.releaseTick - w.tick);
    const launched = w.projectiles.some(
      (p: any) => p.source === ally.id && p.target === claimed.id
    );
    bot.ai = true;
    bot.nextThink = w.tick + 1;
    w.step();
    const chosen = bot.attackTarget;
    g.view.center = { x: 250, y: 0 };
    g.view.locked = false;
    w.reveal = { point: { x: 250, y: 0 }, endTick: Infinity };
    g.view.render(w, 1, performance.now() / 1000);
    return { launched, chosen, available: available.id, claimed: claimed.id, bot: bot.id };
  });
  expect(result.launched).toBe(true);
  expect(result.chosen).toBe(result.available);
  await page.screenshot({ path: 'artifacts/bot-incoming-last-hit.png' });
  const outcome = await page.evaluate(({ available, claimed, bot }) => {
    const w = (window as any).__GAME__.world;
    w.step(55);
    return {
      available: w.unit(available).hp,
      claimed: w.unit(claimed).hp,
      cs: w.championState(bot).cs,
    };
  }, result);
  expect(outcome).toEqual({ available: 0, claimed: 0, cs: 1 });
});
