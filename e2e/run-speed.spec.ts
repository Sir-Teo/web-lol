import { expect, test } from '@playwright/test';

test('all mobile source rigs scale run playback with gameplay speed, slows and haste', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.units = [w.hero];
    w.battlefield.findPath = (_from: any, to: any) => [{ x: to.x, y: to.y }];
    const units = [w.hero];
    for (const team of ['blue', 'red'])
      for (const kind of ['melee', 'caster', 'siege', 'super']) {
        const u = w.spawn(kind, team, { x: 0, y: 0 });
        u.ai = false;
        units.push(u);
      }
    const results = [];
    for (const u of units) {
      const nominal = w.battlefield.unitStats?.[u.kind]?.[u.team]?.speed ?? 325;
      for (const [scale, slow, haste] of [
        [1, false, false],
        [1.25, false, false],
        [1.25, true, false],
        [1, true, true],
      ]) {
        u.speed = nominal * Number(scale);
        u.slowUntil = slow ? w.tick + 100 : 0;
        w.healSpeedEnd = haste ? w.tick + 100 : 0;
        const multiplier =
          Number(scale) * (slow ? 0.7 : 1) * (haste && u.id === w.hero.id ? 1.3 : 1);
        const before = { x: u.x, y: u.y };
        w.enqueue({
          type: 'order',
          unit: u.id,
          order: { type: 'move', point: { x: u.x + 2000, y: u.y } },
        });
        w.step();
        v.render(w, 1, v.previousElapsed + 0.1);
        const model = v.models.get(u.id);
        results.push({
          clip: model.actionName,
          rate: model.actions.run.timeScale,
          multiplier,
          distance: Math.hypot(u.x - before.x, u.y - before.y),
          expectedDistance: (nominal * multiplier) / 60,
        });
      }
    }
    return results;
  });
  expect(results).toHaveLength(36);
  for (const result of results) {
    expect(result.clip).toBe('run');
    expect(result.rate).toBeCloseTo(result.multiplier);
    expect(result.distance).toBeCloseTo(result.expectedDistance);
  }
});
