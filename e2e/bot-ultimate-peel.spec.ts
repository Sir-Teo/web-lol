import { expect, test } from '@playwright/test';

test('retreating bot uses R against a visible attack and resumes fountain movement', async ({
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
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
    bot.hp = 100;
    bot.ai = true;
    const state = w.championState(bot.id);
    state.cooldowns.f = w.tick + 10000;
    w.setOrder(w.hero, { type: 'attack', target: bot.id });
    w.step(2);
    const pending = state.pendingCast?.ability;
    g.view.render(w, 1, performance.now() / 1000);
    const clip = g.view.models.get(bot.id).actionName;
    w.step(39);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      pending,
      clip,
      stunned: w.hero.stunUntil > w.tick,
      bothAlive: bot.hp > 0 && w.hero.hp > 0,
      retreating: bot.aiRetreating,
      order: bot.order,
      home: w.battlefield.spawns.red,
      escaped: bot.x > 300,
    };
  });
  expect(result.pending).toBe('r');
  expect(result.clip).toBe('spell4');
  expect(result.stunned).toBe(true);
  expect(result.bothAlive).toBe(true);
  expect(result.retreating).toBe(true);
  expect(result.order).toEqual({ type: 'move', point: result.home });
  expect(result.escaped).toBe(true);
  expect(errors).toEqual([]);
});
