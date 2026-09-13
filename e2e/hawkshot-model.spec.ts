import { expect, test } from '@playwright/test';

test('source hawks animate independently, restore their cast phase and preserve shared GPU resources', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 14000, y: w.hero.y },
    });
    w.step(300);
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x, y: w.hero.y + 14000 },
    });
    w.step();
    v.render(w, 1, 0);
    const [first, second] = w.projectiles;
    const skin = (id: number) => {
      let skin: any;
      v.projectileModels.get(id).traverse((child: any) => {
        if (child.isSkinnedMesh) skin = child;
      });
      return skin;
    };
    const pose = (mesh: any) =>
      mesh.skeleton.bones.map((b: any) => [...b.position.toArray(), ...b.quaternion.toArray()]);
    const a = skin(first.id),
      b = skin(second.id);
    const before = pose(a),
      secondBefore = pose(b);
    const independent = a.skeleton !== b.skeleton && a.skeleton.bones[0] !== b.skeleton.bones[0];
    const shared = a.geometry === b.geometry && a.material === b.material;
    v.render(w, 1, 0.8);
    const paused = pose(a);
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    let geometryDisposed = 0,
      materialDisposed = 0,
      poseDisposed = 0;
    a.geometry.addEventListener('dispose', () => geometryDisposed++);
    a.material.addEventListener('dispose', () => materialDisposed++);
    a.skeleton.boneTexture.addEventListener('dispose', () => poseDisposed++);
    w.projectiles = [second];
    v.render(w, 1, 0);
    const survivor = pose(skin(second.id));
    v.render(restored, 1, 0);
    const recovered = pose(skin(first.id));
    restored.step(20);
    v.render(restored, 1, 0);
    const animated = pose(skin(first.id));
    return {
      independent,
      shared,
      before,
      secondBefore,
      paused,
      survivor,
      recovered,
      animated,
      geometryDisposed,
      materialDisposed,
      poseDisposed,
      triangles: a.geometry.index.count / 3,
      bones: a.skeleton.bones.length,
    };
  });
  expect(result.independent).toBe(true);
  expect(result.shared).toBe(true);
  expect(result.bones).toBe(5);
  expect(result.triangles).toBe(642);
  expect(result.before).not.toEqual(result.secondBefore);
  expect(result.paused).toEqual(result.before);
  expect(result.survivor).toEqual(result.secondBefore);
  expect(result.recovered).toEqual(result.before);
  expect(result.animated).not.toEqual(result.before);
  expect(result.poseDisposed).toBe(1);
  expect(result.geometryDisposed).toBe(0);
  expect(result.materialDisposed).toBe(0);
});
