import { expect, test } from '@playwright/test';

test('critically low bot flashes away from a visible champion and resumes retreat', async ({
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
    const bot = w.spawn('champion', 'red', { x: 200, y: 0 });
    bot.hp = 50;
    bot.ai = true;
    const state = w.championState(bot.id);
    state.cooldowns.f = state.cooldowns.r = w.tick + 10000;
    w.step();
    const queued = w.commands.some(
      (c: any) => c.type === 'cast' && c.unit === bot.id && c.ability === 'd'
    );
    w.step();
    const clearance = Math.hypot(bot.x - w.hero.x, bot.y - w.hero.y);
    const ownCooldown = w.abilityCooldownTicks('d', bot.id);
    g.view.render(w, 1, performance.now() / 1000);
    w.step(18);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      queued,
      clearance,
      ownCooldown,
      humanCooldown: w.abilityCooldownTicks('d'),
      retreating: bot.aiRetreating,
      order: bot.order.type,
    };
  });
  expect(result.queued).toBe(true);
  expect(result.clearance).toBeGreaterThanOrEqual(400);
  expect(result.ownCooldown).toBe(18000);
  expect(result.humanCooldown).toBe(0);
  expect(result.retreating).toBe(true);
  expect(result.order).toBe('move');
  expect(errors).toEqual([]);
});
