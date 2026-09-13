import { expect, test } from '@playwright/test';

test('endpoint glows render both source sizes and restore RGB/alpha independently', async ({
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
    w.step(50);
    v.render(w, 1, 0);
    const before = v.arrivalGlows.meshes.size;
    w.step(7);
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const state = () =>
      [...v.arrivalGlows.meshes].map(([key, m]: any) => ({
        key,
        name: m.name,
        color: m.material.color.toArray(),
        alpha: m.material.opacity,
        scale: m.scale.toArray(),
        position: m.position.toArray(),
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
    for (const m of v.arrivalGlows.meshes.values()) m.visible = false;
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    let changed = 0;
    shown.forEach((x: number, i: number) => {
      if (x !== hidden[i]) changed++;
    });
    const individual = [...v.arrivalGlows.meshes.values()].map((mesh: any) => {
      mesh.visible = true;
      v.renderer.render(v.scene, v.camera);
      const pixels = read();
      mesh.visible = false;
      return pixels.reduce(
        (sum: number, value: number, i: number) => sum + Number(value !== hidden[i]),
        0
      );
    });
    let disposed = 0;
    for (const mesh of v.arrivalGlows.meshes.values())
      mesh.material.addEventListener('dispose', () => disposed++);
    restored.step(35);
    v.render(restored, 1, 0);
    const expired = v.arrivalGlows.meshes.size;
    w.visionAreas = areas;
    v.render(w, 1, 0);
    return { before, initial, paused, recovered, expired, changed, individual, disposed };
  });
  expect(result.before).toBe(0);
  expect(result.initial.map((p) => p.name)).toEqual(['flat_top', 'flat_top1']);
  expect(result.initial[0].scale[0]).toBeGreaterThan(result.initial[1].scale[0] * 3);
  expect(result.paused).toEqual(result.initial);
  expect(result.recovered).toEqual(result.initial);
  expect(result.changed).toBeGreaterThan(100);
  expect(result.individual.every((pixels) => pixels > 100)).toBe(true);
  expect(result.disposed).toBe(2);
  expect(result.expired).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-arrival-glows.png' });
});
