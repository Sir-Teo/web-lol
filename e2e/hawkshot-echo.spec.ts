import { expect, test } from '@playwright/test';

test('Owl3 poses freeze, restore independently, pool rigs and retire after arrival', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 1400, y: w.hero.y },
    });
    w.step(30);
    v.render(w, 1, 0);
    const state = () =>
      [...v.echoes.particles]
        .filter(([, e]: any) => e.root.visible)
        .map(([key, e]: any) => {
          const bones: number[] = [];
          e.model.root.traverse((o: any) => {
            if (o.isSkinnedMesh && o.visible)
              for (const b of o.skeleton.bones)
                bones.push(...b.position.toArray(), ...b.quaternion.toArray());
          });
          return {
            key,
            position: e.root.position.toArray(),
            alpha: e.model.material.opacity,
            bones,
          };
        })
        .sort((a, b) => a.key.localeCompare(b.key));
    const before = state();
    v.render(w, 1, 99);
    const paused = state();
    const save = w.snapshot();
    const restored = w.constructor.fromSnapshot(save, w.battlefield);
    const original = [...v.echoes.particles.values()] as any[];
    let disposed = 0;
    for (const e of original) e.model.material.addEventListener('dispose', () => disposed++);
    const flights = w.projectiles;
    w.projectiles = [];
    v.render(w, 1, 0);
    const empty = v.echoes.particles.size;
    v.render(restored, 1, 0);
    const recovered = state();
    const models = new Set<any>();
    for (let i = 0; i < 20; i++) {
      restored.step();
      v.render(restored, 1, 0);
      for (const e of v.echoes.particles.values()) models.add(e.model);
    }
    restored.step(25);
    v.render(restored, 1, 0);
    const tail = state();
    restored.step(25);
    v.render(restored, 1, 0);
    const expired = v.echoes.particles.size;
    w.projectiles = flights;
    v.recenter(w.projectiles[0]);
    v.zoom = 0.45;
    v.resize();
    v.render(w, 1, 0);
    return {
      before,
      paused,
      recovered,
      empty,
      disposed,
      original: original.length,
      pool: models.size,
      tail,
      expired,
    };
  });
  expect(result.before.length).toBeGreaterThan(1);
  expect(result.before[0].bones.length).toBeGreaterThan(20);
  expect(result.before[0].bones).not.toEqual(result.before[1].bones);
  expect(result.paused).toEqual(result.before);
  expect(result.recovered).toEqual(result.before);
  expect(result.empty).toBe(0);
  expect(result.disposed).toBe(result.original);
  expect(result.pool).toBeLessThanOrEqual(4);
  expect(result.tail.length).toBeGreaterThan(0);
  expect(result.expired).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-echo.png' });
});
