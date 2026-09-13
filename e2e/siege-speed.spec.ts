import { expect, test } from '@playwright/test';

test('siege animation duration follows the mid-turret combat cadence for both rigs', async ({
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
    w.reveal = { point: { x: 0, y: 0 }, endTick: Infinity };
    const results = [];
    for (const team of ['blue', 'red']) {
      const source = w.spawn('siege', team, { x: 0, y: 0 });
      source.ai = false;
      source.attackPeriod = 130;
      source.windupTicks = 39;
      source.range = 600;
      const target = w.spawn('turret', team === 'blue' ? 'red' : 'blue', { x: 300, y: 0 });
      target.structure = {
        role: 'outer-turret',
        lane: 'mid',
        regenPerSecond: 0,
        healthBarHeight: 100,
      };
      target.stunUntil = Infinity;
      for (const lane of ['mid', 'top']) {
        target.structure.lane = lane;
        source.releaseTick = null;
        source.nextAttackTick = w.tick;
        w.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: target.id } });
        w.step();
        v.render(w, 1, 0);
        const model = v.models.get(source.id),
          action = model.actions.attack1;
        results.push({
          team,
          lane,
          clip: model.actionName,
          animationSeconds: action.getClip().duration / action.timeScale,
          simulationSeconds: (source.nextAttackTick - w.tick) / 60,
        });
      }
      w.units = [w.hero];
    }
    return results;
  });
  expect(results).toHaveLength(4);
  for (const result of results) {
    expect(result.clip).toBe('attack1');
    expect(result.animationSeconds).toBeCloseTo(result.lane === 'mid' ? 100 / 60 : 130 / 60);
    expect(result.animationSeconds).toBeCloseTo(result.simulationSeconds);
  }
});
