import { expect, test } from '@playwright/test';

test('endpoint wispy particle survives pause/restore and releases its material', async ({
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
    const point = { x: w.hero.x + 700, y: w.hero.y };
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
    w.step(47);
    v.render(w, 1, 0);
    const before = v.darkness.meshes.size;
    w.step(7);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const state = () =>
      [...v.darkness.meshes.values()].map((m: any) => ({
        position: m.position.toArray(),
        scale: m.scale.toArray(),
        rotation: m.quaternion.toArray(),
        alpha: m.material.opacity,
        frame: m.material.userData.uniforms.darknessFrame.value,
        drive: m.material.userData.uniforms.darknessDrive.value,
      }));
    const initial = state();
    v.render(w, 1, 99);
    const paused = state();
    const saved = w.snapshot(),
      areas = w.visionAreas;
    w.visionAreas = [];
    v.render(w, 1, 0);
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(restored, 1, 0);
    const recovered = state();
    const read = () => {
      const gl = v.renderer.getContext(),
        pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      return pixels;
    };
    const shown = read();
    let disposed = 0;
    for (const m of v.darkness.meshes.values()) {
      m.visible = false;
      m.material.addEventListener('dispose', () => disposed++);
    }
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const changed = shown.reduce(
      (n: number, x: number, i: number) => n + Number(x !== hidden[i]),
      0
    );
    restored.step(35);
    v.render(restored, 1, 0);
    const expired = v.darkness.meshes.size;
    w.visionAreas = areas;
    v.render(w, 1, 0);
    return { before, initial, paused, recovered, changed, expired, disposed };
  });
  expect(result.before).toBe(0);
  expect(result.initial).toHaveLength(1);
  expect(result.paused).toEqual(result.initial);
  expect(result.recovered).toEqual(result.initial);
  expect(result.changed).toBeGreaterThan(20);
  expect(result.expired).toBe(0);
  expect(result.disposed).toBe(1);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-darkness.png' });
  await page.evaluate(() => {
    const v = (window as any).__GAME__.view;
    for (const mesh of v.arrivalGlows.meshes.values()) mesh.visible = false;
    for (const burst of v.arrivals.bursts.values()) burst.root.visible = false;
    v.renderer.render(v.scene, v.camera);
  });
  await page.screenshot({ path: 'artifacts/browser-hawkshot-darkness-without-glows.png' });
});

test('DarknessFollow erosion samples blue independently of red and green', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js' as string);
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
      point: { x: w.hero.x + 700, y: w.hero.y },
    });
    w.step(54);
    v.render(w, 1, 0);
    const mesh: any = [...v.darkness.meshes.values()][0];
    const material = mesh.material;
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const erosion = new T.DataTexture(new Uint8Array([255, 255, 128, 255]), 1, 1);
    erosion.needsUpdate = true;
    material.map = white;
    material.color.setRGB(1, 1, 1);
    material.opacity = 1;
    material.userData.uniforms.darknessErosion.value = erosion;
    const scene = new T.Scene();
    scene.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.setScalar(1);
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.z = 2;
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(32, 32);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(32, 32);
    renderer.setRenderTarget(target);
    const sample = (drive: number) => {
      material.userData.uniforms.darknessDrive.value = drive;
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
      return pixel[0];
    };
    const values = [sample(0), sample(128 / 255 + 0.05), sample(0.7)];
    material.dispose();
    white.dispose();
    erosion.dispose();
    target.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return values;
  });
  expect(result[0]).toBeGreaterThanOrEqual(254);
  expect(Math.abs(result[1] - 128)).toBeLessThanOrEqual(2);
  expect(result[2]).toBe(0);
});
