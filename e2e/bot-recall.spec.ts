import { expect, test } from '@playwright/test';

test('a healthy bot returns to spend banked gold and leaves with functional purchases', async ({
  page,
}) => {
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
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    w.hero.x = -3500;
    w.hero.y = -3000;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
    bot.ai = true;
    const state = w.championState(bot.id);
    state.gold = 1000;
    const before = { damage: bot.damage, speed: bot.speed };
    w.step(2);
    const shopping = state.recallEnd !== null && !bot.aiRetreating;
    w.step(520);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      shopping,
      inventory: state.inventory,
      gold: state.gold,
      damage: bot.damage - before.damage,
      speed: bot.speed - before.speed,
      recall: state.recallEnd,
      order: bot.order.type,
    };
  });
  expect(result).toEqual({
    shopping: true,
    inventory: ['blade', 'boots'],
    gold: 250,
    damage: 10,
    speed: 25,
    recall: null,
    order: 'move',
  });
  expect(errors).toEqual([]);
});

test('a safe retreating bot channels recall, returns home and resumes its plan', async ({
  page,
}) => {
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
    bot.ai = true;
    bot.hp = 100;
    const state = w.championState(bot.id);
    w.step(2);
    const deadline = state.recallEnd;
    if (deadline === null) throw new Error('Bot did not start recall');
    w.step(120);
    g.view.render(w, 1, performance.now() / 1000);
    const channelPreserved = state.recallEnd === deadline;
    w.step(deadline - w.tick);
    const arrived = bot.x === w.battlefield.spawns.red.x && bot.y === w.battlefield.spawns.red.y;
    const healed = bot.hp === bot.maxHp;
    w.step(18);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      channelPreserved,
      arrived,
      healed,
      retreating: bot.aiRetreating,
      order: bot.order.type,
    };
  });
  expect(result).toEqual({
    channelPreserved: true,
    arrived: true,
    healed: true,
    retreating: false,
    order: 'move',
  });
  expect(errors).toEqual([]);
});
