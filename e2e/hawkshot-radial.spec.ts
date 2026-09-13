import { expect, test } from '@playwright/test';

test('radial burst draws source atlas instances, freezes, restores and expires', async ({
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
    w.step(45);
    v.render(w, 1, 0);
    const before = v.radial.mesh?.count ?? 0;
    w.step(15);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const mesh = v.radial.mesh;
    const state = () => ({
      count: mesh.count,
      matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
      values: Array.from(mesh.geometry.attributes.radialFrameAlpha.array.slice(0, mesh.count * 2)),
    });
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
    mesh.visible = false;
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const changed = shown.reduce(
      (n: number, x: number, i: number) => n + Number(x !== hidden[i]),
      0
    );
    restored.step(70);
    v.render(restored, 1, 0);
    const expired = mesh.count;
    w.visionAreas = areas;
    v.render(w, 1, 0);
    return { before, initial, paused, recovered, changed, expired, reused: mesh === v.radial.mesh };
  });
  expect(result.before).toBe(0);
  expect(result.initial.count).toBe(50);
  expect(result.paused).toEqual(result.initial);
  expect(result.recovered).toEqual(result.initial);
  expect(result.changed).toBeGreaterThan(100);
  expect(result.expired).toBe(0);
  expect(result.reused).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-radial.png' });
});
