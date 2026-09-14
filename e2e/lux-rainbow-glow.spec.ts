import { expect, test } from '@playwright/test';

test('RainbowGlow retains source scale, direct quad scroll and fading burst playback', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(67);
    v.center = { x: 1500, y: 0 };
    const mesh = () =>
      [...v.luxBeams.models.values()]
        .flatMap((g: any) => g.children)
        .find((m: any) => m.name === 'RainbowGlow') as any;
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const m = mesh();
      return {
        visible: m.visible,
        count: m.geometry.drawRange.count,
        positions: Array.from(m.geometry.getAttribute('position').array).slice(0, 36),
        scale: m.material.uniforms.baseScale.value.toArray(),
        offset: m.material.uniforms.offset.value.toArray(),
        tint: m.material.uniforms.tint.value.toArray(),
      };
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const material = mesh().material.clone();
    material.blending = THREE.NoBlending;
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const grid = new THREE.DataTexture(
      new Uint8Array(Array.from({ length: 8 }, (_, i) => [i * 32, 0, 0, 255]).flat()),
      8,
      1
    );
    grid.needsUpdate = true;
    material.uniforms.base.value = grid;
    material.uniforms.mult.value = white;
    material.uniforms.tint.value.set(1, 1, 1, 1);
    const renderer = new THREE.WebGLRenderer(),
      target = new THREE.WebGLRenderTarget(1, 1),
      plane = new THREE.PlaneGeometry(2, 2),
      scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    renderer.setSize(1, 1);
    camera.position.z = 5;
    scene.add(new THREE.Mesh(plane, material));
    renderer.setRenderTarget(target);
    const probes = [];
    for (const scroll of [0, 0.2])
      for (const u of [0.125, 0.375, 0.625, 0.875]) {
        material.uniforms.offset.value.set(scroll, 0);
        const uv = plane.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5);
        uv.needsUpdate = true;
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        probes.push({ u, scroll, pixel: [...pixel] });
      }
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    plane.dispose();
    material.dispose();
    white.dispose();
    grid.dispose();
    return { first, repeat, saved, probes };
  });
  expect(result.first.visible).toBe(true);
  expect(result.first.count).toBe(12);
  expect(result.first.positions.slice(18)).toEqual(result.first.positions.slice(0, 18));
  expect(result.first.scale).toEqual([0.4000000059604645, 1]);
  expect(result.first.offset[0]).toBeCloseTo(0.2, 8);
  expect(result.first.offset[1]).toBe(0);
  expect(result.first.tint[3]).toBeCloseTo(0.6200045943260193 * (1 - 0.1 / 0.30000001192092896), 8);
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  for (const p of result.probes) {
    const coordinate = (p.u - 0.5) * 0.4000000059604645 + 0.5 + p.scroll;
    const texel = Math.floor((coordinate - Math.floor(coordinate)) * 8);
    expect(p.pixel).toEqual([texel * 32, 0, 0, 255]);
  }
  await page.screenshot({ path: 'artifacts/lux-r-rainbow-glow.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (const group of g.view.luxBeams.models.values())
      for (const m of group.children) m.material.colorWrite = m.name === 'RainbowGlow';
    for (const m of g.view.luxStreaks.models.values()) m.material.colorWrite = false;
    for (const m of g.view.luxBokeh.models.values()) m.material.colorWrite = false;
    for (const m of g.view.luxScorches.models.values()) m.material.colorWrite = false;
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/lux-r-rainbow-isolated.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (const group of g.view.luxBeams.models.values())
      for (const m of group.children) m.material.colorWrite = true;
    for (const m of g.view.luxStreaks.models.values()) m.material.colorWrite = true;
    for (const m of g.view.luxBokeh.models.values()) m.material.colorWrite = true;
    for (const m of g.view.luxScorches.models.values()) m.material.colorWrite = true;
  });
  const visible = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(13);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.luxBeams.models.values()]
      .flatMap((g: any) => g.children)
      .find((m: any) => m.name === 'RainbowGlow').visible;
  });
  expect(visible).toBe(false);
});
