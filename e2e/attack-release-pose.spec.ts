import { expect, test } from '@playwright/test';

for (const renderStart of [false, true]) {
  test(`Lux release pose survives ${renderStart ? 'a skipped transition' : 'a late first render'}`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate(async (renderStart) => {
      const helperUrl = '/src/content/lux-attack-origin.ts';
      const { luxAttackOrigin } = await import(helperUrl);
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
      const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y + 80 });
      w.setOrder(lux, { type: 'attack', target: target.id });
      let initialWeight: number | null = null;
      if (renderStart) {
        w.step();
        g.view.render(w, 1, 0);
        initialWeight = g.view.models.get(lux.id).actions.attack1.getEffectiveWeight();
      }
      for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
      if (!w.projectiles.length || !lux.attackCycle) throw new Error('Missing released attack');
      const cycle = lux.attackCycle;
      g.view.render(w, 1, 0);
      const model = g.view.models.get(lux.id),
        action = model.actions.attack1;
      const poseTime =
        (action.getClip().duration * (w.tick - cycle.startTick)) /
        (cycle.endTick - cycle.startTick);
      const expected = luxAttackOrigin(poseTime);
      const hand = model.root.getObjectByName('R_Hand');
      const actual = hand.position.clone();
      hand.getWorldPosition(actual);
      model.root.worldToLocal(actual);
      const error = Math.hypot(...actual.toArray().map((v: number, i: number) => v - expected[i]));
      return {
        initialWeight,
        error,
        weight: action.getEffectiveWeight(),
        phaseError: Math.abs(action.time - poseTime),
        age: w.tick - cycle.startTick,
      };
    }, renderStart);
    if (renderStart) expect(result.initialWeight).toBe(0);
    expect(result.age).toBeGreaterThan(5);
    expect(result.phaseError).toBeLessThan(1e-10);
    expect(result.weight).toBe(1);
    expect(result.error).toBeLessThanOrEqual(0.00001);
  });
}
