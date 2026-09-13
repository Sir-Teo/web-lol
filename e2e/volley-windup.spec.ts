import { expect, test } from '@playwright/test';

test('Volley windup seeks the source pose, freezes and restores before releasing once', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const { disposeModel } = await import('/src/render/models.ts');
    const g = (window as any).__GAME__,
      v = g.view;
    let w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = 1e9;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'w',
      point: { x: w.hero.x + 1200, y: w.hero.y },
    });
    w.step(10);
    v.zoom = 0.6;
    v.recenter(w.hero);
    v.resize();
    const pose = () => {
      const model = v.models.get(w.hero.id);
      let bones: number[] = [];
      model.root.traverse((o: any) => {
        if (o.isSkinnedMesh && !bones.length)
          bones = o.skeleton.bones.flatMap((b: any) => [
            ...b.position.toArray(),
            ...b.quaternion.toArray(),
          ]);
      });
      return { clip: model.actionName, time: model.actions.spell2.time, bones };
    };
    v.render(w, 1, v.previousElapsed + 0.1);
    const initial = pose(),
      arrowsBefore = w.projectiles.length;
    v.render(w, 1, v.previousElapsed + 10);
    const paused = pose();
    const saved = w.snapshot(),
      old = v.models.get(w.hero.id);
    v.scene.remove(old.root);
    disposeModel(old);
    v.models.delete(w.hero.id);
    w = World.fromSnapshot(saved, w.battlefield);
    v.render(w, 1, v.previousElapsed + 0.1);
    const restored = pose();
    w.step(5);
    const beforeRelease = w.projectiles.length;
    w.step();
    v.render(w, 1, v.previousElapsed + 0.1);
    const release = {
      count: w.projectiles.length,
      remaining: w.projectiles[3].remaining,
      pending: w.player.pendingCast,
      clip: pose().clip,
    };
    w.step();
    return {
      initial,
      paused,
      restored,
      arrowsBefore,
      beforeRelease,
      release,
      after: w.projectiles.length,
    };
  });
  expect(result.initial.clip).toBe('spell2');
  expect(result.initial.time).toBeCloseTo(0.15);
  expect(result.initial.bones.length).toBeGreaterThan(100);
  expect(result.paused).toEqual(result.initial);
  expect(result.restored).toEqual(result.initial);
  expect(result.arrowsBefore).toBe(0);
  expect(result.beforeRelease).toBe(0);
  expect(result.release).toEqual({ count: 7, remaining: 1175, pending: null, clip: 'idle1' });
  expect(result.after).toBe(7);
  await page.screenshot({ path: 'artifacts/browser-volley-windup.png' });
});
