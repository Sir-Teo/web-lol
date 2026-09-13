import { expect, test } from '@playwright/test';

test('a bot advances along the authored Rift lane beyond the old midpoint destination', async ({
  page,
}) => {
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
    // Isolate route following on the real navigation grid from combat blockers.
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
    const visited = new Set<number>();
    for (let i = 0; i < 900; i++) {
      w.step();
      visited.add(bot.laneWaypoint);
    }
    g.view.render(w, 1, performance.now() / 1000);
    return {
      assigned: bot.lane === index,
      furthest: Math.max(...visited),
      distanceFromOldGoal: Math.hypot(bot.x - lane.points[9].x, bot.y - lane.points[9].y),
    };
  });
  expect(result.assigned).toBe(true);
  expect(result.furthest).toBeGreaterThan(9);
  expect(result.distanceFromOldGoal).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});
