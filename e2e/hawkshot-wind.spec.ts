import { expect, test } from '@playwright/test';

test('wind freezes, restores through arrival and releases its active instances after the tail', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.hero.x = w.hero.y = 0;
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 1120, y: -840 } });
    w.step(50);
    v.recenter(w.projectiles[0]);
    v.render(w, 1, 0);
    const mesh = v.wind.mesh;
    const before = Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16);
    const alpha = Array.from(mesh.geometry.getAttribute('windAlpha').array).slice(0, mesh.count);
    v.render(w, 1, 3);
    return {
      count: mesh.count,
      instanced: mesh.isInstancedMesh,
      before,
      alpha,
      after: Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16),
    };
  });
  expect(flight.instanced).toBe(true);
  expect(flight.count).toBeGreaterThan(0);
  expect(flight.count).toBeLessThanOrEqual(10);
  expect(flight.after).toEqual(flight.before);
  expect(flight.alpha.some((v) => Number(v) > 0)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-wind-flight.png' });
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(20);
    v.render(w, 1, 0);
    const mesh = v.wind.mesh;
    const state = () => ({
      count: mesh.count,
      matrices: Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16),
      alpha: Array.from(mesh.geometry.getAttribute('windAlpha').array).slice(0, mesh.count),
      erosion: Array.from(mesh.geometry.getAttribute('windDrive').array).slice(0, mesh.count),
    });
    const before = state();
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    v.render(restored, 1, 0);
    return { before, after: state(), flights: w.projectiles.length };
  });
  expect(tail.flights).toBe(0);
  expect(tail.before.count).toBeGreaterThan(0);
  expect(tail.after).toEqual(tail.before);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-wind-tail.png' });
  const ended = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    const mesh = v.wind.mesh,
      material = mesh.material,
      geometry = mesh.geometry;
    g.world.step(40);
    v.render(g.world, 1, 0);
    return { count: mesh.count, reused: mesh.material === material && mesh.geometry === geometry };
  });
  expect(ended).toEqual({ count: 0, reused: true });
  expect(errors).toEqual([]);
});

test('wind erosion samples linear green and applies the source feather ramp', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const samples = await page.evaluate(async () => {
    // @ts-expect-error Browser-side Vite module.
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 0, y: 0 } });
    w.step(20);
    g.view.render(w, 1, 0);
    const source = g.view.wind.mesh.material;
    const erosion = new T.DataTexture(new Uint8Array([255, 128, 255, 255]), 1, 1);
    erosion.needsUpdate = true;
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const material = source.clone();
    material.map = white;
    material.color.setRGB(1, 1, 1);
    material.vertexColors = false;
    material.customProgramCacheKey = source.customProgramCacheKey;
    material.onBeforeCompile = (shader: any, renderer: any) => {
      source.onBeforeCompile(shader, renderer);
      shader.uniforms.windErosionMap.value = erosion;
    };
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute('windAlpha', new T.InstancedBufferAttribute(new Float32Array([0.4]), 1));
    const drive = new T.InstancedBufferAttribute(new Float32Array(1), 1);
    geometry.setAttribute('windDrive', drive);
    const mesh = new T.InstancedMesh(geometry, material, 1);
    mesh.setMatrixAt(0, new T.Matrix4());
    const scene = new T.Scene();
    scene.add(mesh);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(8, 8);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    renderer.setClearColor(0);
    const target = new T.WebGLRenderTarget(8, 8);
    renderer.setRenderTarget(target);
    const samples: number[][] = [];
    for (const delta of [-0.1, 0.05, 0.2]) {
      drive.setX(0, 128 / 255 + delta);
      drive.needsUpdate = true;
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 4, 4, 1, 1, pixel);
      samples.push([...pixel].slice(0, 3));
    }
    renderer.setRenderTarget(null);
    target.dispose();
    material.dispose();
    geometry.dispose();
    mesh.dispose();
    white.dispose();
    erosion.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return samples;
  });
  samples.forEach((pixel, i) =>
    pixel.forEach((value) => expect(Math.abs(value - [102, 51, 0][i])).toBeLessThanOrEqual(1))
  );
});
