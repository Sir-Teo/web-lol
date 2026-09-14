import { expect, test } from '@playwright/test';

test('rotating charge rays face both cameras, reconstruct saves and obey visibility', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const data = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { luxChargeRayParticles } = await import('/src/render/lux-charge-ray-particles.ts');
    const { default: profile } = await import('/src/content/lux-charge-rays.json');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    v.center = { x: 0, y: 0 };
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const m = v.luxChargeRays.models.get(lux.id);
      return {
        count: m.geometry.drawRange.count,
        pass: m.renderOrder,
        depth: m.material.depthTest,
        ...Object.fromEntries(
          ['position', 'uv', 'particleColor', 'particleOffset'].map((k) => [
            k,
            Array.from(m.geometry.getAttribute(k).array),
          ])
        ),
      };
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const cast = w.championState(lux.id).pendingCast;
    const particle = luxChargeRayParticles(
      lux.id ^ Math.imul(cast.startTick, 0x9e3779b9) ^ Math.imul(profile.emitterIndex, 0x85ebca6b),
      (w.tick - cast.startTick) / 60
    )[0];
    const angle = (-particle.rotation * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const expectedCorner = [
      (-c + s) * particle.halfSize[0] * 0.01,
      (-s - c) * particle.halfSize[1] * 0.01,
    ];
    const normals = [],
      corners = [];
    for (const z of [-12, 12]) {
      const camera = new T.PerspectiveCamera();
      camera.position.set(0, 18, z);
      camera.lookAt(0, 0, 0);
      v.luxChargeRays.update(w, 1, camera);
      const positions = v.luxChargeRays.models.get(lux.id).geometry.getAttribute('position'),
        normal = new T.Vector3();
      camera.getWorldDirection(normal);
      const a = new T.Vector3().fromBufferAttribute(positions, 0),
        b = new T.Vector3().fromBufferAttribute(positions, 1),
        c = new T.Vector3().fromBufferAttribute(positions, 2);
      const displacement = a.clone().sub(new T.Vector3(-1.2, v.ground({ x: 0, y: 0 }) + 0.18, 0));
      corners.push([
        displacement.dot(new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)),
        displacement.dot(new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)),
      ]);
      normals.push([b.sub(a).normalize().dot(normal), c.sub(a).normalize().dot(normal)]);
    }
    sample(w);
    const visible = w.pointVisible;
    lux.team = 'red';
    w.pointVisible = () => false;
    v.luxChargeRays.update(w, 1, v.camera);
    const hidden = v.luxChargeRays.models.size;
    lux.team = 'blue';
    w.pointVisible = visible;
    const restored = sample(w);
    return { first, repeat, saved, normals, corners, expectedCorner, hidden, restored };
  });
  expect(data.first.count).toBe(60);
  expect(data.first.pass).toBe(500);
  expect(data.first.depth).toBe(false);
  expect(data.repeat).toEqual(data.first);
  expect(data.saved).toEqual(data.first);
  expect(data.restored).toEqual(data.first);
  expect(data.hidden).toBe(0);
  for (const values of data.normals)
    for (const value of values) expect(Math.abs(value)).toBeLessThan(1e-5);
  for (const corner of data.corners)
    corner.forEach((v, i) => expect(v).toBeCloseTo(data.expectedCorner[i], 5));
  expect((data.first.uv as number[]).slice(0, 12)).toEqual([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
  await page.screenshot({ path: 'artifacts/lux-rotating-charge-rays.png' });
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(29);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return g.view.luxChargeRays.models.size;
  });
  expect(end).toBe(0);
});

for (const reason of ['victory', 'death'])
  test(`rotating charge rays retire on ${reason}`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate((reason) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
        target = w.spawn('nexus', 'red', { x: 1000, y: 500 }),
        gate = w.spawn('inhibitor', 'red', { x: 1500, y: 500 });
      w.damage(w.hero, gate, 1e6, 'true');
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
      w.step(30);
      v.render(w, 1, v.previousElapsed);
      const before = v.luxChargeRays.models.size;
      if (reason === 'victory') w.damage(w.hero, target, 1e6, 'true');
      else w.damage(target, lux, 1e6, 'true');
      v.render(w, 1, v.previousElapsed);
      const after = v.luxChargeRays.models.size;
      v.render(w, 1, v.previousElapsed + 1);
      return { before, after, later: v.luxChargeRays.models.size, released: w.luxBeams.length };
    }, reason);
    expect(result).toEqual({ before: 1, after: 0, later: 0, released: 0 });
  });
