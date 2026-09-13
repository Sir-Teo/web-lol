import { expect, test } from '@playwright/test';

test('bot scouts fog ahead on the real Rift with a saved charge in reserve', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    for (const u of w.units) {
      u.ai = false;
      if (u.team === 'red') {
        u.hp = 0;
        u.deadAt = w.tick;
        u.respawnTick = null;
      }
    }
    const index = w.battlefield.lanes.findIndex((lane: any) => lane.name === 'mid');
    const lane = w.battlefield.lanes[index];
    const bot = w.spawn('champion', 'blue', { ...lane.points[8] });
    bot.ai = true;
    bot.lane = index;
    w.gainExperience(660, bot.id);
    w.step();
    const cast = w.commands.find(
      (c: any) => c.type === 'cast' && c.unit === bot.id && c.ability === 'e'
    );
    if (!cast) throw new Error('Bot did not select a scout destination');
    const initiallyHidden = !w.pointVisible(cast.point, bot.team);
    w.step();
    const state = w.championState(bot.id);
    const pending = state.pendingCast?.ability;
    g.view.render(w, 1, performance.now() / 1000);
    const clip = g.view.models.get(bot.id).actionName;
    w.step(220);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      initiallyHidden,
      pending,
      clip,
      charges: state.eCharges,
      revealed: w.pointVisible(cast.point, bot.team),
      ownScout: w.visionAreas.some((a: any) => a.kind === 'scout' && a.sourceId === bot.id),
      moving: bot.order.type === 'move',
    };
  });
  expect(result.initiallyHidden).toBe(true);
  expect(result.pending).toBe('e');
  expect(result.clip).toBe('spell3');
  expect(result.charges).toBe(1);
  expect(result.revealed).toBe(true);
  expect(result.ownScout).toBe(true);
  expect(result.moving).toBe(true);
  expect(errors).toEqual([]);
});
