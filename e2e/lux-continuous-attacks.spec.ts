import { expect, test } from '@playwright/test';

test('continuous Lux attacks retain source poses across variant changes and movement', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const url = '/src/content/lux-attack-origin.ts';
    const { luxAttackOrigin } = await import(url);
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    const clips = new Set<string>();
    let maxError = 0,
      poses = 0,
      moved = false;
    let lastCycle = -1,
      lastClip = '',
      switches = 0,
      repeats = 0;
    for (let i = 0; i < 1100; i++) {
      if (i === 400) w.setOrder(lux, { type: 'move', point: { x: lux.x, y: lux.y + 80 } });
      if (i === 425) w.setOrder(lux, { type: 'attack', target: target.id });
      w.step();
      // Deliberately vary render frequency; saved pose must not depend on frame cadence.
      if (i % 3 !== 0) continue;
      g.view.render(w, 1, i / 60);
      const model = g.view.models.get(lux.id),
        cycle = lux.attackCycle;
      if (model.actionName === 'run') moved = true;
      if (!cycle || !['attack1', 'attack2'].includes(model.actionName)) continue;
      if (cycle.startTick !== lastCycle) {
        if (lastCycle >= 0) {
          if (model.actionName === lastClip) repeats++;
          else switches++;
        }
        lastCycle = cycle.startTick;
        lastClip = model.actionName;
      }
      if (w.tick - cycle.startTick < 5) continue;
      const action = model.actions[model.actionName];
      const expectedTime =
        (action.getClip().duration * (w.tick - cycle.startTick)) /
        (cycle.endTick - cycle.startTick);
      const expected = luxAttackOrigin(expectedTime, model.actionName);
      const hand = model.root.getObjectByName('R_Hand'),
        actual = hand.position.clone();
      hand.getWorldPosition(actual);
      model.root.worldToLocal(actual);
      maxError = Math.max(
        maxError,
        Math.hypot(...actual.toArray().map((v: number, j: number) => v - expected[j]))
      );
      poses++;
      clips.add(model.actionName);
    }
    return { clips: [...clips].sort(), maxError, poses, moved, switches, repeats };
  });
  expect(result.clips).toEqual(['attack1', 'attack2']);
  expect(result.moved).toBe(true);
  expect(result.switches).toBeGreaterThan(0);
  expect(result.repeats).toBeGreaterThan(0);
  expect(result.poses).toBeGreaterThan(250);
  expect(result.maxError).toBeLessThanOrEqual(0.00001);
});
