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

test('Hawkshot adds alpha-weighted light without darkening the framebuffer', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const samples = await page.evaluate(async () => {
    // @ts-expect-error Browser-side Vite module.
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, 0);
    const flight = w.projectiles.find((p: any) => p.type === 'hawkshot');
    let source: any;
    g.view.projectileModels.get(flight.id).traverse((o: any) => {
      if (o.isSkinnedMesh) source = o.material;
    });
    // Use the loaded body's actual blend state, isolating it from texture and scene lighting.
    const material = source.clone();
    material.map = null;
    material.opacity = 0.5;
    material.color.setRGB(0.2, 0.4, 0.6);
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(8, 8);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(8, 8);
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;
    const geometry = new T.PlaneGeometry(2, 2);
    scene.add(new T.Mesh(geometry, material));
    renderer.setRenderTarget(target);
    const sample = (background: number) => {
      renderer.setClearColor(new T.Color().setRGB(background, background, background), 1);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 4, 4, 1, 1, pixel);
      return [...pixel].slice(0, 3);
    };
    const dark = sample(0.1),
      light = sample(0.5);
    material.color.setRGB(0, 0, 0);
    const black = sample(0.5);
    renderer.setRenderTarget(null);
    target.dispose();
    material.dispose();
    geometry.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { dark, light, black };
  });
  // RGB_out = RGB_background + alpha_source * RGB_source; allow byte quantization.
  for (const [name, expected] of Object.entries({
    dark: [51, 77, 102],
    light: [153, 179, 204],
    black: [128, 128, 128],
  })) {
    samples[name as keyof typeof samples].forEach((value: number, i: number) =>
      expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(1)
    );
  }
});
