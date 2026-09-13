import { expect, test } from '@playwright/test';

test('smoke atlas instances freeze and reconstruct through arrival without accumulating draws', async ({
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
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 1400, y: w.hero.y },
    });
    w.step(45);
    v.render(w, 1, 0);
    const state = () => {
      const m = v.smoke.mesh;
      return {
        count: m.count,
        matrix: Array.from(m.instanceMatrix.array).slice(0, m.count * 16),
        frame: Array.from(m.geometry.attributes.smokeFrame.array).slice(0, m.count),
        alpha: Array.from(m.geometry.attributes.smokeAlpha.array).slice(0, m.count),
      };
    };
    const before = state(),
      mesh = v.smoke.mesh;
    v.render(w, 1, 99);
    const paused = state();
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    v.render(restored, 1, 0);
    const recovered = state();
    restored.step(30);
    v.render(restored, 1, 0);
    const tail = state();
    restored.step(40);
    v.render(restored, 1, 0);
    const expired = state().count;
    const reused = mesh === v.smoke.mesh;
    const releasedDepth = v.smoke.depth.target === undefined;
    v.recenter(w.projectiles[0]);
    v.zoom = 0.45;
    v.resize();
    v.render(w, 1, 0);
    return { before, paused, recovered, tail, expired, reused, releasedDepth };
  });
  expect(result.before.count).toBeGreaterThan(8);
  expect(new Set(result.before.frame).size).toBe(4);
  expect(result.paused).toEqual(result.before);
  expect(result.recovered).toEqual(result.before);
  expect(result.tail.count).toBeGreaterThan(0);
  expect(result.expired).toBe(0);
  expect(result.reused).toBe(true);
  expect(result.releasedDepth).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-smoke.png' });
});

test('smoke GPU erosion uses red and intersection fading follows scene depth through resize', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Browser Vite module.
    const T = await import('/node_modules/three/build/three.module.js');
    // @ts-expect-error Browser Vite module.
    const { HawkshotSmoke } = await import('/src/render/hawkshot-smoke.ts');
    const scene = new T.Scene(),
      smoke = new HawkshotSmoke(scene, () => 0);
    smoke.allocate(1);
    smoke.mesh.count = 1;
    smoke.mesh.setMatrixAt(0, new T.Matrix4());
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const erosion = new T.DataTexture(new Uint8Array([128, 255, 255, 255]), 1, 1);
    erosion.needsUpdate = true;
    const material = smoke.material;
    material.map = white;
    material.color.setRGB(1, 1, 1);
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = (shader: any, renderer: any) => {
      compile(shader, renderer);
      shader.uniforms.smokeErosion.value = erosion;
    };
    const attributes = smoke.mesh.geometry.attributes;
    attributes.smokeFrame.setX(0, 0);
    attributes.smokeAlpha.setX(0, 1);
    const background = new T.Mesh(
      new T.PlaneGeometry(10, 10),
      new T.MeshBasicMaterial({ color: 0 })
    );
    scene.add(background);
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.z = 2;
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(32, 32);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(32, 32);
    renderer.setRenderTarget(target);
    const sample = (gap: number, drive: number) => {
      background.position.z = -gap;
      attributes.smokeDrive.setX(0, drive);
      attributes.smokeDrive.needsUpdate = true;
      smoke.prepareDepth(renderer, camera);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
      return pixel[0];
    };
    const far = sample(1, 0),
      mid = sample(0.175, 0),
      near = sample(0.035, 0),
      eroded = sample(1, 0.6),
      gone = sample(1, 0.8);
    const visible = smoke.mesh.visible && background.visible;
    renderer.setSize(48, 48);
    smoke.prepareDepth(renderer, camera);
    const resized = [smoke.depth.target.width, smoke.depth.target.height];
    smoke.mesh.count = 0;
    smoke.prepareDepth(renderer, camera);
    const released = smoke.depth.target === undefined;
    smoke.mesh.geometry.dispose();
    smoke.mesh.dispose();
    material.dispose();
    white.dispose();
    erosion.dispose();
    background.geometry.dispose();
    background.material.dispose();
    renderer.setRenderTarget(null);
    target.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { far, mid, near, eroded, gone, visible, resized, released };
  });
  expect(result.far).toBeGreaterThanOrEqual(254);
  expect(Math.abs(result.mid - 128)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.near - 7)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.eroded - 130)).toBeLessThanOrEqual(2);
  expect(result.gone).toBe(0);
  expect(result.visible && result.released).toBe(true);
  expect(result.resized).toEqual([48, 48]);
});
