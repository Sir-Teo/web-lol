import { expect, test } from '@playwright/test';

test('endpoint Aurora waits for arrival, freezes, restores and expires independently of reveal', async ({
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
    w.step(44);
    v.render(w, 1, 0);
    const before = v.arrivals.bursts.size;
    w.step();
    v.render(w, 1, 0);
    const atArrival = v.arrivals.bursts.size;
    w.step(8);
    v.render(w, 1, 0);
    const state = () =>
      [...v.arrivals.bursts].map(([id, b]: any) => ({
        id,
        position: b.root.position.toArray(),
        rotation: b.root.rotation.toArray(),
        alpha: b.mesh.material.opacity,
      }));
    const initial = state();
    v.render(w, 1, 99);
    const paused = state();
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    const areas = w.visionAreas;
    w.visionAreas = [];
    v.render(w, 1, 0);
    const cleared = v.arrivals.bursts.size;
    v.render(restored, 1, 0);
    const recovered = state();
    restored.step(40);
    v.render(restored, 1, 0);
    const expired = v.arrivals.bursts.size,
      reveal = restored.visionAreas.some((a: any) => a.kind === 'scout');
    w.visionAreas = areas;
    v.recenter(point);
    v.zoom = 0.5;
    v.resize();
    v.render(w, 1, 0);
    const read = () => {
      const gl = v.renderer.getContext(),
        data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data
      );
      return data;
    };
    const shown = read();
    for (const b of v.arrivals.bursts.values()) b.root.visible = false;
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    let changed = 0;
    for (let i = 0; i < shown.length; i++) if (shown[i] !== hidden[i]) changed++;
    for (const b of v.arrivals.bursts.values()) b.root.visible = true;
    v.renderer.render(v.scene, v.camera);
    return { before, atArrival, initial, paused, cleared, recovered, expired, reveal, changed };
  });
  expect(result.before).toBe(0);
  expect(result.atArrival).toBe(1);
  expect(result.initial[0].alpha).toBeGreaterThan(0);
  expect(result.paused).toEqual(result.initial);
  expect(result.cleared).toBe(0);
  expect(result.recovered).toEqual(result.initial);
  expect(result.expired).toBe(0);
  expect(result.reveal).toBe(true);
  expect(result.changed).toBeGreaterThan(100);
  await page.screenshot({ path: 'artifacts/browser-hawkshot-arrival.png' });
});
