import { expect, test } from '@playwright/test';

test('lingering sparkle renders after sight expiry, restores and disposes', async ({ page }) => {
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
    w.step(46);
    const effect = w.scoutVisuals[0];
    w.step(effect.stopTick - w.tick + 3);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const state = () =>
      [...v.sparkle.meshes].map(([key, m]: any) => ({
        key,
        position: m.position.toArray(),
        scale: m.scale.toArray(),
        alpha: m.material.opacity,
      }));
    const initial = state();
    v.render(w, 1, 99);
    const paused = state();
    const saved = w.snapshot(),
      effects = w.scoutVisuals;
    w.scoutVisuals = [];
    v.render(w, 1, 0);
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(restored, 1, 0);
    const recovered = state();
    const read = () => {
      const gl = v.renderer.getContext(),
        p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p
      );
      return p;
    };
    const shown = read();
    let disposed = 0;
    for (const m of v.sparkle.meshes.values()) {
      m.visible = false;
      m.material.addEventListener('dispose', () => disposed++);
    }
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const changed = shown.reduce(
      (sum: number, value: number, i: number) => sum + Number(value !== hidden[i]),
      0
    );
    restored.step(25);
    v.render(restored, 1, 0);
    const expired = v.sparkle.meshes.size;
    w.scoutVisuals = effects;
    v.render(w, 1, 0);
    return { initial, paused, recovered, changed, disposed, expired, vision: w.visionAreas.length };
  });
  expect(result.initial.length).toBeGreaterThan(0);
  expect(result.vision).toBe(0);
  expect(result.paused).toEqual(result.initial);
  expect(result.recovered).toEqual(result.initial);
  expect(result.changed).toBeGreaterThan(0);
  expect(result.disposed).toBe(result.initial.length);
  expect(result.expired).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-sparkle-tail.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    const mesh: any = [...v.sparkle.meshes.values()][0];
    v.recenter({ x: mesh.position.x * 100, y: mesh.position.z * 100 });
    v.zoom = 0.15;
    v.resize();
    v.render(g.world, 1, 0);
    v.camera.position.y +=
      mesh.position.y - v.ground({ x: mesh.position.x * 100, y: mesh.position.z * 100 });
    v.camera.updateMatrixWorld();
    v.renderer.render(v.scene, v.camera);
    // Keep the diagnostic camera until screenshot; the normal frame loop resets its height.
    v.render = () => {};
  });
  await page.screenshot({ path: 'artifacts/browser-hawkshot-sparkle-detail.png' });
});
