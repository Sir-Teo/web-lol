import { expect, test } from '@playwright/test';

test('bot pursues a safe alternative while another target is protected by a tower', async ({
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
    // Isolate tower-safe target choice from the fixture's brush occlusion.
    w.battlefield.lineOfSight = () => true;
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    w.hero.x = -3500;
    w.hero.y = -3000;
    const bot = w.spawn('champion', 'blue', { x: 0, y: 0 });
    const tower = w.spawn('turret', 'red', { x: 1000, y: 0 });
    tower.range = 750;
    w.spawn('champion', 'red', { x: 1000, y: 0 });
    const safe = w.spawn('melee', 'red', { x: -1050, y: 0 });
    safe.speed = 0;
    bot.ai = true;
    w.step();
    g.view.render(w, 1, performance.now() / 1000);
    return {
      safeVisible: w.visible(safe, bot.team),
      choseSafe: bot.order.type === 'attack' && bot.order.target === safe.id,
      movingAway: bot.x < 0,
    };
  });
  expect(result).toEqual({ safeVisible: true, choseSafe: true, movingAway: true });
  expect(errors).toEqual([]);
});

test('a healthy bot leaves an unsupported tower and holds outside its range', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = new World(false, {
      ...g.world.battlefield,
      initialUnits: [],
      lineOfSight: () => true,
      findPath: (_a: any, b: any) => [{ ...b }],
      reachable: (p: any) => ({ ...p }),
      lineWalkable: () => true,
    });
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -10000;
    const bot = w.spawn('champion', 'blue', { x: 0, y: 0 });
    const tower = w.spawn('turret', 'red', { x: 700, y: 0 });
    tower.range = 750;
    tower.nextAttackTick = 10000;
    bot.ai = true;
    w.setOrder(bot, { type: 'attack', target: tower.id });
    w.step();
    const retreats = bot.order.type === 'move' && bot.x < 0;
    w.step(360);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      retreats,
      safe: Math.hypot(bot.x - tower.x, bot.y - tower.y) > tower.range + bot.radius,
      order: bot.order.type,
      attacks: w.events.filter((e: any) => e.type === 'attack' && e.unit === bot.id).length,
    };
  });
  expect(result).toEqual({ retreats: true, safe: true, order: 'idle', attacks: 0 });
  expect(errors).toEqual([]);
});
