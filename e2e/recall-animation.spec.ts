import { expect, test } from '@playwright/test';

test('recall seeks its source sequence, freezes, restores, cancels and restarts', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const { disposeModel } = await import('/src/render/models.ts');
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    let w = new World(false, g.world.battlefield);
    w.nextWaveTick = 1e9;
    const render = () => v.render(w, 1, v.previousElapsed + 0.1);
    const state = () => {
      const m = v.models.get(w.hero.id);
      let pose: number[] = [];
      m.root.traverse((o: any) => {
        if (o.isSkinnedMesh && !pose.length)
          pose = o.skeleton.bones.flatMap((b: any) => [
            ...b.position.toArray(),
            ...b.quaternion.toArray(),
          ]);
      });
      return { clip: m.actionName, time: m.actions[m.actionName].time, pose };
    };
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    w.step(30);
    render();
    const first = state();
    w.step(360);
    render();
    const second = state();
    v.render(w, 1, v.previousElapsed + 30);
    const paused = state();
    const saved = w.snapshot();
    const m = v.models.get(w.hero.id);
    v.scene.remove(m.root);
    disposeModel(m);
    v.models.delete(w.hero.id);
    w = World.fromSnapshot(saved, w.battlefield);
    render();
    const restored = state();
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'idle' } });
    w.step();
    render();
    const cancelled = state().clip;
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    render();
    const restarted = state();
    w.step(480);
    render();
    return {
      first,
      second,
      paused,
      restored,
      cancelled,
      restarted,
      completed: w.player.recallEnd,
      finalClip: state().clip,
    };
  });
  expect(result.first.clip).toBe('idle5');
  expect(result.first.time).toBeCloseTo(0.5);
  expect(result.second.clip).toBe('idle2');
  expect(result.second.time).toBeCloseTo(6.5 - 5.966667175);
  expect(result.paused).toEqual(result.second);
  expect(result.restored).toEqual(result.second);
  expect(result.cancelled).toBe('idle1');
  expect(result.restarted.clip).toBe('idle5');
  expect(result.restarted.time).toBe(0);
  expect(result.completed).toBeNull();
  expect(result.finalClip).toBe('idle1');
  expect(result.first.pose).not.toEqual(result.second.pose);
});

test('recall renders both source stages and damage interrupts the pose', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const unit of w.units) unit.ai = false;
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    w.step(120);
    v.zoom = 0.6;
    v.recenter(w.hero);
    v.resize();
    v.render(w, 1, v.previousElapsed + 0.1);
  });
  await page.screenshot({ path: 'artifacts/browser-recall-first.png' });
  const second = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(270);
    g.view.render(g.world, 1, g.view.previousElapsed + 0.1);
    return g.view.models.get(g.world.hero.id).actionName;
  });
  expect(second).toBe('idle2');
  await page.screenshot({ path: 'artifacts/browser-recall-second.png' });
  const interrupted = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.damage(w.hero, w.hero, 1, 'true');
    v.render(w, 1, v.previousElapsed + 0.1);
    const damaged = { recall: w.player.recallEnd, clip: v.models.get(w.hero.id).actionName };
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    v.render(w, 1, v.previousElapsed + 0.1);
    w.damage(w.hero, w.hero, 1e6, 'true');
    v.render(w, 1, v.previousElapsed + 0.1);
    return { damaged, dead: v.models.get(w.hero.id).actionName };
  });
  expect(interrupted.damaged).toEqual({ recall: null, clip: 'idle1' });
  expect(interrupted.dead).toBe('death');
});
