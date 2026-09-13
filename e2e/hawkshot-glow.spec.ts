import { expect, test } from '@playwright/test';

test('source background quads appear after their delay, restore and share resources', async ({
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
      point: { x: w.hero.x + 4200, y: w.hero.y },
    });
    w.step(16);
    v.render(w, 1, 0);
    const id = w.projectiles[0].id;
    const layers = () =>
      v.projectileModels.get(id).getObjectByName('Hawkshot source background').children;
    const state = () =>
      layers().map((m: any) => ({
        name: m.name,
        visible: m.visible,
        position: m.position.toArray(),
        scale: m.scale.toArray(),
        color: m.material.color.toArray(),
        alpha: m.material.opacity,
        order: m.renderOrder,
      }));
    const initial = state();
    w.step(6);
    v.render(w, 1, 0);
    const before = state();
    w.step();
    v.render(w, 1, 0);
    const emitted = state();
    v.render(w, 1, 100);
    const paused = state();
    const meshes = [...layers()];
    let disposed = 0;
    for (const m of meshes) {
      m.geometry.addEventListener('dispose', () => disposed++);
      m.material.addEventListener('dispose', () => disposed++);
    }
    const saved = w.snapshot();
    const projectiles = w.projectiles;
    w.projectiles = [];
    v.render(w, 1, 0);
    const removed = !v.projectileModels.has(id);
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(restored, 1, 0);
    const recovered = state();
    const shared = layers().every(
      (m: any, i: number) => m.geometry === meshes[i].geometry && m.material === meshes[i].material
    );
    w.projectiles = projectiles;
    w.step(25);
    v.recenter(w.projectiles[0]);
    v.zoom = 0.45;
    v.resize();
    v.render(w, 1, 0);
    return { initial, before, emitted, paused, recovered, removed, shared, disposed };
  });
  expect(result.initial.map((x: any) => x.visible)).toEqual([false, false]);
  expect(result.before.map((x: any) => x.visible)).toEqual([false, false]);
  expect(result.emitted.map((x: any) => x.visible)).toEqual([true, true]);
  expect(result.emitted.map((x: any) => x.position)).toEqual([
    [0, -0.5, 0],
    [0, -0.3, 0],
  ]);
  expect(result.emitted.map((x: any) => x.scale)).toEqual([
    [1.8, 1.8, 1.8],
    [1.8, 1.8, 1.8],
  ]);
  expect(result.emitted.map((x: any) => x.order)).toEqual([-6, -5]);
  expect(result.paused).toEqual(result.emitted);
  expect(result.recovered).toEqual(result.emitted);
  expect(result.removed && result.shared).toBe(true);
  expect(result.disposed).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-glow.png' });
});

test('both decoded glow layers contribute pixels with distinct blend behavior', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const pixels = await page.evaluate(async () => {
    // @ts-expect-error Browser Vite import.
    const T = await import('/node_modules/three/build/three.module.js');
    // @ts-expect-error Browser Vite import.
    const { createHawkshotGlow, animateHawkshotGlow } =
      await import('/src/render/hawkshot-glow.ts');
    const root = createHawkshotGlow();
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(32, 32);
    renderer.setRenderTarget(target);
    renderer.setClearColor(new T.Color().setRGB(0.1, 0.1, 0.1), 1);
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    scene.add(root);
    const sample = () => {
      renderer.render(scene, camera);
      const out = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 16, 12, 1, 1, out);
      return Array.from(out).slice(0, 3);
    };
    const before = sample();
    animateHawkshotGlow(root, 0.2);
    root.children[1].visible = false;
    const blue = sample();
    root.children[0].visible = false;
    root.children[1].visible = true;
    const violet = sample();
    root.children[0].visible = true;
    const both = sample();
    renderer.setRenderTarget(null);
    target.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { before, blue, violet, both };
  });
  expect(pixels.before).toEqual([26, 26, 26]);
  expect(pixels.blue[0]).toBeLessThan(pixels.before[0]);
  expect(pixels.blue[2]).toBeGreaterThan(pixels.before[2]);
  for (let i = 0; i < 3; i++) {
    expect(pixels.violet[i]).toBeGreaterThan(pixels.before[i]);
    expect(pixels.both[i]).toBeGreaterThan(pixels.blue[i]);
  }
});
