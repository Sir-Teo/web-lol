import { expect, test } from '@playwright/test';
for (const phase of ['charging', 'fired'])
  test(`scorches ${phase} victory playback has no invented burst and retires`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const data = await page.evaluate((phase) => {
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
      w.step(phase === 'charging' ? 30 : 67);
      v.render(w, 1, v.previousElapsed);
      w.damage(w.hero, target, 1e6, 'true');
      const saved = w.snapshot(),
        start = v.previousElapsed;
      const sample = (age: number) => {
        v.render(w, 1, start + age);
        return [...v.luxScorches.models.values()].map((m: any) => ({
          positions: Array.from(m.geometry.getAttribute('position').array),
          tint: m.material.uniforms.tint.value.toArray(),
        }));
      };
      const initial = sample(0),
        later = sample(0.2),
        repeat = sample(0.2),
        expired = sample(1.6),
        replay = sample(0.2);
      w.step(120);
      return { initial, later, repeat, expired, replay, unchanged: w.snapshot() === saved };
    }, phase);
    expect(data.unchanged).toBe(true);
    expect(data.repeat).toEqual(data.later);
    expect(data.replay).toEqual(data.later);
    expect(data.expired).toEqual([]);
    if (phase === 'charging') {
      expect(data.initial).toEqual([]);
      expect(data.later).toEqual([]);
    } else {
      expect(data.initial.length).toBe(2);
      expect(data.later).not.toEqual(data.initial);
    }
  });

test('scorches project source footprints, reconstruct visibility and outlast the previous beam tail', async ({
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
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(88);
    v.center = { x: 1500, y: 0 };
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      return [...v.luxScorches.models.values()].map((m: any) => ({
        name: m.name,
        count: m.geometry.drawRange.count,
        positions: Array.from(m.geometry.getAttribute('position').array),
        indices: Array.from(m.geometry.index.array).slice(0, m.geometry.drawRange.count),
        tint: m.material.uniforms.tint.value.toArray(),
        pass: m.renderOrder,
        transparent: m.material.transparent,
        depth: m.material.depthTest,
        bounds: [m.geometry.boundingBox.min.toArray(), m.geometry.boundingBox.max.toArray()],
      }));
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const beam = w.luxBeams[0],
      visible = w.pointVisible;
    beam.team = 'red';
    w.pointVisible = (p: any) => p.x > 1500;
    const partial = sample(w).map((m) => m.count);
    w.pointVisible = () => false;
    v.luxScorches.update(w, 1);
    const hidden = v.luxScorches.models.size;
    beam.team = 'blue';
    w.pointVisible = visible;
    const restored = sample(w);
    return { first, repeat, saved, partial, hidden, restored };
  });
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  expect(result.restored).toEqual(result.first);
  expect(result.hidden).toBe(0);
  expect(result.first.map((m) => m.name)).toEqual(['Burnt', 'Burnt1']);
  expect(result.first.map((m) => m.count)).toEqual([3840, 960]);
  for (let i = 0; i < 2; i++) {
    const m = result.first[i];
    expect(m.transparent).toBe(false);
    expect(m.depth).toBe(false);
    expect(m.pass).toBe(-5);
    expect(m.bounds[0][0]).toBe(-5);
    expect(m.bounds[1][0]).toBe(35);
    expect(m.bounds[0][2]).toBe(i === 0 ? -2 : -0.5);
    expect(m.bounds[1][2]).toBe(i === 0 ? 2 : 0.5);
    for (let j = 1; j < m.positions.length; j += 3) expect(m.positions[j]).toBeCloseTo(0.02, 6);
    expect(m.tint[3]).toBeCloseTo(i === 0 ? 0.8 : 1, 6);
    expect(m.tint[0]).toBeCloseTo(0.17000076174736023, 7);
    expect(result.partial[i]).toBeGreaterThan(0);
    expect(result.partial[i]).toBeLessThan(m.count);
  }
  await page.screenshot({ path: 'artifacts/lux-scorches.png' });
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(54);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return { beams: g.world.luxBeams.length, scorches: g.view.luxScorches.models.size };
  });
  expect(tail).toEqual({ beams: 1, scorches: 2 });
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(9);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return { beams: g.world.luxBeams.length, scorches: g.view.luxScorches.models.size };
  });
  expect(end).toEqual({ beams: 0, scorches: 0 });
});

test('scorch shader keeps raw source tint and separate source-alpha blending', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(88);
    g.view.render(w, 1, g.view.previousElapsed);
    const original = [...g.view.luxScorches.models.values()][0] as any,
      material = original.material.clone(),
      tex = original.material.uniforms.base.value;
    const flags = {
      raw: tex.colorSpace === T.NoColorSpace,
      flip: tex.flipY,
      linear: tex.minFilter === T.LinearFilter && tex.magFilter === T.LinearFilter,
      mips: tex.generateMipmaps,
    };
    const texture = new T.DataTexture(new Uint8Array([128, 96, 64, 128]), 1, 1);
    texture.needsUpdate = true;
    material.uniforms.base.value = texture;
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      geometry = new T.PlaneGeometry(2, 2),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    scene.add(new T.Mesh(geometry, material));
    renderer.setSize(1, 1);
    renderer.setClearColor(new T.Color(0.2, 0.3, 0.4), 1);
    renderer.setRenderTarget(target);
    const pixels = [];
    for (const blend of [T.NoBlending, T.CustomBlending]) {
      material.blending = blend;
      renderer.render(scene, camera);
      const p = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, p);
      pixels.push([...p]);
    }
    const tint = material.uniforms.tint.value.toArray();
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    return { pixels, tint, flags };
  });
  expect(result.flags).toEqual({ raw: true, flip: false, linear: true, mips: false });
  const source = [128, 96, 64, 128].map((v, i) => (v / 255) * result.tint[i]);
  result.pixels.forEach((p, index) =>
    p.forEach((value, i) => {
      const expected =
        index === 0 ? source[i] : source[i] * source[3] + [0.2, 0.3, 0.4, 1][i] * (1 - source[3]);
      expect(Math.abs(value - expected * 255)).toBeLessThanOrEqual(1);
    })
  );
});
