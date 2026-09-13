import { expect, test } from '@playwright/test';

test('late first render uses scheduled speed and phase, stays frozen while paused and restores after release', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const pose = () => {
      let values: number[] = [];
      v.models.get(w.hero.id).root.traverse((object: any) => {
        if (object.isSkinnedMesh && !values.length)
          values = object.skeleton.bones.flatMap((bone: any) => [
            ...bone.position.toArray(),
            ...bone.quaternion.toArray(),
            ...bone.scale.toArray(),
          ]);
      });
      return values;
    };
    const difference = (a: number[], b: number[]) =>
      Math.max(...a.map((value, i) => Math.abs(value - b[i])));
    w.nextWaveTick = Infinity;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
    w.player.qUntil = w.tick + 2;
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: target.id } });
    w.step(10);
    v.render(w, 1, v.previousElapsed + 0.1);
    const action = v.models.get(w.hero.id).actions.attack1;
    const duration = action.getClip().duration;
    const initial = { period: duration / action.timeScale, phase: action.time / duration };
    const initialPose = pose();
    v.render(w, 1, v.previousElapsed + 10);
    const pausedPhase = action.time / duration;
    const pausedPoseDifference = difference(initialPose, pose());
    w.step(20); // Past release, but still inside this attack's recovery.
    v.render(w, 1, v.previousElapsed + 0.1);
    const expectedPose = pose();
    const { World } = await import('/src/simulation/world.ts');
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    const previous = v.models.get(w.hero.id);
    previous.mixer.stopAllAction();
    v.scene.remove(previous.root);
    v.models.delete(w.hero.id);
    v.render(restored, 1, v.previousElapsed + 0.1);
    const fresh = v.models.get(w.hero.id),
      resumed = fresh.actions.attack1;
    const restoredPhase = resumed.time / resumed.getClip().duration;
    return {
      initial,
      pausedPhase,
      restoredPhase,
      clip: fresh.actionName,
      released: restored.hero.releaseTick === null,
      poseValues: expectedPose.length,
      movedPoseDifference: difference(initialPose, expectedPose),
      pausedPoseDifference,
      restoredPoseDifference: difference(expectedPose, pose()),
    };
  });
  expect(result.initial.period).toBeCloseTo(76 / 60);
  expect(result.initial.phase).toBeCloseTo(9 / 76);
  expect(result.pausedPhase).toBeCloseTo(result.initial.phase);
  expect(result.released).toBe(true);
  expect(result.clip).toBe('attack1');
  expect(result.restoredPhase).toBeCloseTo(29 / 76);
  expect(result.poseValues).toBeGreaterThan(100);
  expect(result.movedPoseDifference).toBeGreaterThan(0.001);
  expect(result.pausedPoseDifference).toBeLessThan(1e-7);
  expect(result.restoredPoseDifference).toBeLessThan(1e-7);
});
