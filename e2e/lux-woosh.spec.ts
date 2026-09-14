import { expect, test } from '@playwright/test';

test('Final Spark moving flash follows source velocity, quad extents and saved clock', async ({
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
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const m = [...v.luxBeams.models.values()]
        .flatMap((g: any) => g.children)
        .find((m: any) => m.name === 'WOOSH') as any;
      return {
        visible: m.visible,
        flashVertices: [...v.luxBeams.models.values()]
          .flatMap((g: any) => g.children)
          .find((m: any) => m.name === 'Beam_Core_FLASH').geometry.drawRange.count,
        count: m.geometry.drawRange.count,
        positions: Array.from(m.geometry.getAttribute('position').array).slice(0, 18),
        second: Array.from(m.geometry.getAttribute('position').array).slice(18, 36),
        uv: Array.from(m.geometry.getAttribute('uv').array).slice(0, 12),
        tint: m.material.uniforms.tint.value.toArray(),
        pass: m.renderOrder,
      };
    };
    v.center = { x: 1800, y: 0 };
    w.step(64);
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    return { first, repeat, saved };
  });
  expect(result.first.visible).toBe(true);
  expect(result.first.count).toBe(12);
  expect(result.first.flashVertices).toBe(768);
  expect(result.first.second).toEqual(result.first.positions);
  expect(result.first.pass).toBe(60);
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  expect(result.first.uv).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1]);
  expect(result.first.tint).toEqual([1, 0.7450980544090271, 0.23529411852359772, 1]);
  const vertices = Array.from(
    { length: 6 },
    (_, i) => result.first.positions.slice(i * 3, i * 3 + 3) as number[]
  );
  expect(vertices.map((v) => v[0])).toEqual([10, 10, 26, 10, 26, 26]);
  expect(vertices.map((v) => v[2])).toEqual([-3.5, 3.5, 3.5, -3.5, 3.5, -3.5]);
  await page.screenshot({ path: 'artifacts/lux-r-woosh.png' });
  const later = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const sample = () => {
      g.view.render(g.world, 1, g.view.previousElapsed);
      const m = [...g.view.luxBeams.models.values()]
        .flatMap((g: any) => g.children)
        .find((m: any) => m.name === 'WOOSH') as any;
      return { visible: m.visible, x: m.geometry.getAttribute('position').getX(0) };
    };
    g.world.step(3);
    const moving = sample();
    g.world.step(2);
    return { moving, expired: sample() };
  });
  expect(later.moving.visible).toBe(true);
  expect(later.moving.x).toBeCloseTo(0, 5);
  expect(later.expired.visible).toBe(false);
});
