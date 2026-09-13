import { expect, test } from '@playwright/test';

test('lingering Aurora survives pause/restore and releases its material', async ({ page }) => {
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
    w.step(44);
    v.render(w, 1, 0);
    const before = v.lingerAurora.meshes.size;
    w.step(61);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const state = () =>
      [...v.lingerAurora.meshes.values()].map((m: any) => ({
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
      areas = w.scoutVisuals;
    w.scoutVisuals = [];
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
    for (const m of v.lingerAurora.meshes.values()) {
      m.visible = false;
      m.material.addEventListener('dispose', () => disposed++);
    }
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const changed = shown.reduce(
      (n: number, x: number, i: number) => n + Number(x !== hidden[i]),
      0
    );
    restored.step(200);
    v.render(restored, 1, 0);
    const expired = v.lingerAurora.meshes.size;
    w.scoutVisuals = areas;
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
  await page.screenshot({ path: 'artifacts/browser-hawkshot-linger-aurora.png' });
});

test('Aurora multiplier affects RGB and alpha independently of blue erosion', async ({ page }) => {
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
    w.step(105);
    v.render(w, 1, 0);
    const mesh: any = [...v.lingerAurora.meshes.values()][0];
    const material = mesh.material;
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const erosion = new T.DataTexture(new Uint8Array([255, 255, 128, 255]), 1, 1);
    erosion.needsUpdate = true;
    material.map = white;
    material.color.setRGB(1, 1, 1);
    material.opacity = 1;
    material.userData.uniforms.darknessErosion.value = erosion;
    material.userData.uniforms.auroraMultiply.value = white;
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
    const values = [sample(0), sample(128 / 255 + 0.15), sample(0.9)];
    const tint = new T.DataTexture(new Uint8Array([64, 128, 255, 128]), 1, 1);
    tint.needsUpdate = true;
    material.userData.uniforms.auroraMultiply.value = tint;
    const multiplied = sample(0);
    const stripe = new T.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
    stripe.wrapS = stripe.wrapT = T.RepeatWrapping;
    stripe.needsUpdate = true;
    material.userData.uniforms.auroraMultiply.value = stripe;
    material.userData.uniforms.auroraScroll.value.set(0.25, 0);
    const dark = sample(0);
    material.userData.uniforms.auroraScroll.value.set(0.75, 0);
    const wrapped = sample(0);
    stripe.dispose();
    tint.dispose();
    material.dispose();
    white.dispose();
    erosion.dispose();
    target.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { values, multiplied, dark, wrapped };
  });
  expect(result.values[0]).toBeGreaterThanOrEqual(254);
  expect(Math.abs(result.values[1] - 128)).toBeLessThanOrEqual(2);
  expect(result.values[2]).toBe(0);
  expect(Math.abs(result.multiplied - 32)).toBeLessThanOrEqual(2);
  expect(result.dark).toBe(0);
  expect(result.wrapped).toBeGreaterThanOrEqual(254);
});
