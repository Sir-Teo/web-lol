import { expect, test } from '@playwright/test';
test('both snow layers contribute pixels after reveal expiry and restore their batches', async ({
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
    w.step(46);
    w.step(w.scoutVisuals[0].stopTick - w.tick + 3);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const state = () =>
      v.snow.map((s: any) => ({
        count: s.mesh.count,
        matrices: Array.from(s.mesh.instanceMatrix.array.slice(0, s.mesh.count * 16)),
        frame: Array.from(s.mesh.geometry.attributes.snowFrame.array.slice(0, s.mesh.count)),
        alpha: Array.from(s.mesh.geometry.attributes.snowAlpha.array.slice(0, s.mesh.count)),
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
    for (const s of v.snow) s.mesh.visible = false;
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const changes = v.snow.map((s: any) => {
      s.mesh.visible = true;
      v.renderer.render(v.scene, v.camera);
      const p = read();
      s.mesh.visible = false;
      return p.reduce((n: number, x: number, i: number) => n + Number(x !== hidden[i]), 0);
    });
    restored.step(61);
    v.render(restored, 1, 0);
    const expired = v.snow.map((s: any) => s.mesh.count);
    w.scoutVisuals = effects;
    v.render(w, 1, 0);
    return { initial, paused, recovered, changes, expired, vision: w.visionAreas.length };
  });
  expect(result.vision).toBe(0);
  expect(result.initial.every((s: any) => s.count > 0)).toBe(true);
  expect(result.paused).toEqual(result.initial);
  expect(result.recovered).toEqual(result.initial);
  expect(result.changes.every((n: number) => n > 10)).toBe(true);
  expect(result.expired).toEqual([0, 0]);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-snow-tail.png' });
});
