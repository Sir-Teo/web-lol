import { expect, test } from '@playwright/test';

test('dust atlas instances freeze and reconstruct through arrival without accumulating draws', async ({
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
      const m = v.dust.mesh;
      return {
        count: m.count,
        matrix: Array.from(m.instanceMatrix.array).slice(0, m.count * 16),
        frame: Array.from(m.geometry.attributes.dustFrame.array).slice(0, m.count),
        alpha: Array.from(m.geometry.attributes.dustAlpha.array).slice(0, m.count),
      };
    };
    const before = state(),
      mesh = v.dust.mesh;
    v.render(w, 1, 99);
    const paused = state();
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    v.render(restored, 1, 0);
    const recovered = state();
    restored.step(30);
    v.render(restored, 1, 0);
    const tail = state();
    restored.step(65);
    v.render(restored, 1, 0);
    const expired = state().count;
    const reused = mesh === v.dust.mesh;
    v.recenter(w.projectiles[0]);
    v.zoom = 0.45;
    v.resize();
    v.render(w, 1, 0);
    return { before, paused, recovered, tail, expired, reused };
  });
  expect(result.before.count).toBeGreaterThan(20);
  expect(new Set(result.before.frame).size).toBe(4);
  expect(result.paused).toEqual(result.before);
  expect(result.recovered).toEqual(result.before);
  expect(result.tail.count).toBeGreaterThan(0);
  expect(result.expired).toBe(0);
  expect(result.reused).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-dust.png' });
});

test('dust shader selects four distinct atlas cells and fades without changing shared texture state', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const pixels = await page.evaluate(async () => {
    // @ts-expect-error Browser Vite module.
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 1400, y: w.hero.y },
    });
    w.step(20);
    g.view.render(w, 1, 0);
    const source = g.view.dust.mesh;
    const geometry = source.geometry.clone();
    const mesh = new T.InstancedMesh(geometry, source.material, 1);
    mesh.setMatrixAt(0, new T.Matrix4());
    const scene = new T.Scene();
    scene.add(mesh);
    const camera = new T.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(32, 32);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0, 1);
    const frames = [];
    const sample = (frame: number, alpha: number) => {
      geometry.attributes.dustFrame.setX(0, frame);
      geometry.attributes.dustFrame.needsUpdate = true;
      geometry.attributes.dustAlpha.setX(0, alpha);
      geometry.attributes.dustAlpha.needsUpdate = true;
      renderer.render(scene, camera);
      const bytes = new Uint8Array(32 * 32 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 32, 32, bytes);
      return Array.from(bytes).filter((_, i) => i % 4 !== 3);
    };
    for (let i = 0; i < 4; i++) frames.push(sample(i, 1));
    const faded = sample(0, 0.5),
      transparent = sample(0, 0);
    const offset = source.material.map.offset.toArray();
    renderer.setRenderTarget(null);
    target.dispose();
    geometry.dispose();
    mesh.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { frames, faded, transparent, offset };
  });
  expect(new Set(pixels.frames.map((f) => JSON.stringify(f))).size).toBe(4);
  for (const f of pixels.frames) expect(f.some((v) => v > 0)).toBe(true);
  expect(pixels.transparent.every((v) => v === 0)).toBe(true);
  pixels.faded.forEach((v, i) =>
    expect(Math.abs(v - pixels.frames[0][i] * 0.5)).toBeLessThanOrEqual(1)
  );
  expect(pixels.offset).toEqual([0, 0]);
});
