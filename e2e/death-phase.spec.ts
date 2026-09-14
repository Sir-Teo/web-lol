import { expect, test } from '@playwright/test';

test('mobile death poses seek on late render and match fresh restored rigs without advancing while paused', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const units = [w.hero];
    for (const team of ['blue', 'red'])
      for (const kind of ['melee', 'caster', 'siege', 'super']) {
        const u = w.spawn(kind, team, { x: w.hero.x + units.length * 20, y: w.hero.y });
        u.ai = false;
        units.push(u);
      }
    const pose = (id: number) => {
      let values: number[] = [];
      v.models.get(id).root.traverse((o: any) => {
        if (o.isSkinnedMesh && !values.length)
          values = o.skeleton.bones.flatMap((b: any) => [
            ...b.position.toArray(),
            ...b.quaternion.toArray(),
            ...b.scale.toArray(),
          ]);
      });
      return values;
    };
    const difference = (a: number[], b: number[]) =>
      Math.max(...a.map((n, i) => Math.abs(n - b[i])));
    v.render(w, 1, v.previousElapsed + 0.1);
    for (const u of units) w.damage(w.hero, u, 1e6, 'true');
    w.step(24);
    v.render(w, 1, v.previousElapsed);
    const before = units.map((u: any) => ({
      id: u.id,
      pose: pose(u.id),
      time: v.models.get(u.id).actions.death.time,
    }));
    v.render(w, 1, v.previousElapsed + 10);
    const frozen = before.map((b: any) => difference(b.pose, pose(b.id)));
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const u of units) {
      const model = v.models.get(u.id);
      model.mixer.stopAllAction();
      v.scene.remove(model.root);
      v.models.delete(u.id);
    }
    v.render(restored, 1, v.previousElapsed);
    return before.map((b: any, i: number) => ({
      time: b.time,
      frozen: frozen[i],
      poseValues: b.pose.length,
      restoredDifference: difference(b.pose, pose(b.id)),
      restoredTime: v.models.get(b.id).actions.death.time,
      barHidden: v.healthBars.get(b.id)?.hidden,
    }));
  });
  expect(results).toHaveLength(9);
  for (const result of results) {
    expect(result.time).toBeCloseTo(0.4);
    expect(result.restoredTime).toBeCloseTo(0.4);
    expect(result.poseValues).toBeGreaterThan(100);
    expect(result.frozen).toBeLessThan(1e-7);
    expect(result.restoredDifference).toBeLessThan(1e-7);
    expect(result.barHidden).toBe(true);
  }
});

test('terminal presentation finishes mobile deaths while the match clock remains frozen', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const u = w.spawn('super', 'red', w.hero);
    u.ai = false;
    w.damage(w.hero, u, 1e6, 'true');
    w.winner = 'blue';
    v.render(w, 1, v.previousElapsed + 0.1);
    const tick = w.tick,
      model = v.models.get(u.id),
      duration = model.actions.death.getClip().duration;
    v.render(w, 1, v.previousElapsed + duration + 0.3);
    return {
      tick,
      currentTick: w.tick,
      time: model.actions.death.time,
      duration,
      visible: model.root.visible,
    };
  });
  expect(result.currentTick).toBe(result.tick);
  expect(result.time).toBeCloseTo(result.duration);
  expect(result.visible).toBe(false);
});
