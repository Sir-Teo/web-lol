import { expect, test } from '@playwright/test';

test('inhibitor destruction seeks on restore and its remembered clock survives hidden regrowth', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const results = [];
    for (const team of ['blue', 'red']) {
      const u = w.units.find(
        (u: any) => u.team === team && u.kind === 'inhibitor' && u.structure.lane === 'mid'
      );
      for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret']) {
        const defender = w.units.find(
          (u: any) => u.team === team && u.structure?.lane === 'mid' && u.structure?.role === role
        );
        w.damage(w.hero, defender, 1e6, 'true');
      }
      w.damage(w.hero, u, 1e6, 'true');
      w.step(24);
      v.render(w, 1, v.previousElapsed + 0.1);
      const pose = () => {
        let values: number[] = [];
        v.models.get(u.id).root.traverse((o: any) => {
          if (o.isSkinnedMesh && !values.length)
            values = o.skeleton.bones.flatMap((b: any) => [
              ...b.position.toArray(),
              ...b.quaternion.toArray(),
              ...b.scale.toArray(),
            ]);
        });
        return values;
      };
      const model = v.models.get(u.id),
        before = pose();
      const time = model.actions[model.destroyedClip].time;
      const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
      model.mixer.stopAllAction();
      v.scene.remove(model.root);
      v.models.delete(u.id);
      v.render(restored, 1, v.previousElapsed + 0.1);
      const fresh = v.models.get(u.id),
        after = pose();
      const difference = Math.max(...before.map((n: number, i: number) => Math.abs(n - after[i])));
      const originalClock = fresh.destructionTick;
      // Isolate remembered destroyed state from hidden live regrowth. No sight update is run here.
      if (team === 'red') {
        u.deadAt = null;
        u.hp = u.maxHp;
        u.structureKnowledge.blue = true;
      }
      w.tick += 600;
      v.render(w, 1, v.previousElapsed + 0.1);
      const action = fresh.actions[fresh.deadIdleClip];
      const duration = fresh.actions[fresh.destroyedClip].getClip().duration;
      const expected = ((w.tick - originalClock) / 60 - duration) % action.getClip().duration;
      results.push({
        time,
        difference,
        values: before.length,
        sameClock: fresh.destructionTick === originalClock,
        action: fresh.actionName,
        expectedAction: fresh.deadIdleClip,
        idleTime: action.time,
        expected,
      });
    }
    return results;
  });
  for (const result of results) {
    expect(result.time).toBeCloseTo(0.4);
    expect(result.values).toBeGreaterThan(100);
    expect(result.difference).toBeLessThan(1e-7);
    expect(result.sameClock).toBe(true);
    expect(result.action).toBe(result.expectedAction);
    expect(result.idleTime).toBeCloseTo(result.expected);
  }
});
