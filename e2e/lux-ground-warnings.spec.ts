import { expect, test } from '@playwright/test';
for (const reason of ['victory', 'death'])
  test(`ground warning beams retire on ${reason}`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate((reason) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
        target = w.spawn('nexus', 'red', { x: 1000, y: 500 }),
        gate = w.spawn('inhibitor', 'red', { x: 1500, y: 500 });
      w.damage(w.hero, gate, 1e6, 'true');
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
      w.step(30);
      v.render(w, 1, v.previousElapsed);
      const before = v.luxGroundWarnings.models.size;
      if (reason === 'victory') w.damage(w.hero, target, 1e6, 'true');
      else w.damage(target, lux, 1e6, 'true');
      v.render(w, 1, v.previousElapsed);
      const after = v.luxGroundWarnings.models.size;
      v.render(w, 1, v.previousElapsed + 1);
      return { before, after, later: v.luxGroundWarnings.models.size, released: w.luxBeams.length };
    }, reason);
    expect(result).toEqual({ before: 2, after: 0, later: 0, released: 0 });
  });

test('ground warnings preserve endpoint extension, contracting widths, scroll and saved visibility', async ({
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
    w.step(30);
    v.center = { x: 1500, y: 0 };
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      return [...v.luxGroundWarnings.models.values()].map((m: any) => ({
        name: m.name,
        position: Array.from(m.geometry.getAttribute('position').array),
        uv: Array.from(m.geometry.getAttribute('uv').array),
        indices: Array.from(m.geometry.index.array).slice(0, m.geometry.drawRange.count),
        tint: m.material.uniforms.tint.value.toArray(),
        scroll: m.material.uniforms.offset.value.toArray(),
        pass: m.renderOrder,
      }));
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const buffers = [...v.luxGroundWarnings.models.values()].map((m: any) =>
      m.geometry.getAttribute('position')
    );
    w.step(12);
    const later = sample(w);
    const reused = [...v.luxGroundWarnings.models.values()].every(
      (m: any, i: number) => m.geometry.getAttribute('position') === buffers[i]
    );
    const visible = w.pointVisible;
    lux.team = 'red';
    w.pointVisible = (p: any) => p.x > 1500;
    const partial = sample(w).map((m) => m.indices.length);
    w.pointVisible = () => false;
    v.luxGroundWarnings.update(w, 1);
    const hidden = v.luxGroundWarnings.models.size;
    lux.team = 'blue';
    w.pointVisible = visible;
    const restored = sample(w);
    return { first, repeat, saved, later, reused, partial, hidden, restored };
  });
  expect(result.first.map((m) => m.name)).toEqual(['warning_beam_3', 'warning_beam_4']);
  expect(result.first.map((m) => m.pass)).toEqual([5, 0]);
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  expect(result.restored).toEqual(result.later);
  expect(result.reused).toBe(true);
  expect(result.hidden).toBe(0);
  const age = 29 / 60;
  const widths = [
    500 *
      (0.20000000298023224 +
        ((0.10000000149011612 - 0.20000000298023224) * age) / 0.6000000238418579),
    300 *
      (0.30000001192092896 +
        ((0.05000000074505806 - 0.30000001192092896) * (age - 0.20000000298023224)) /
          (1 - 0.20000000298023224)),
  ];
  let scroll = 0;
  for (let k = 1; k <= 29; k++)
    scroll +=
      (Math.max(0, k / 60 - 0.30000001192092896) * 0.453000009059906) /
      (1 - 0.30000001192092896) /
      60;
  result.first.forEach((m, i) => {
    expect(m.position[0]).toBe(-1.5);
    expect(m.position.at(-3)).toBeCloseTo(33.4, 5);
    expect(m.position[2]).toBeCloseTo(-widths[i] * 0.01, 6);
    expect(m.uv.slice(0, 2)).toEqual([0, 0]);
    expect(m.uv.slice(-2)).toEqual([1, 1]);
    expect(m.scroll[0]).toBeCloseTo(scroll, 10);
    expect(m.scroll[1]).toBe(0);
    for (let j = 1; j < m.position.length; j += 3) expect(m.position[j]).toBeCloseTo(0.02, 6);
    expect(result.partial[i]).toBeGreaterThan(0);
    expect(result.partial[i]).toBeLessThan(m.indices.length);
  });
  expect(result.first[0].tint.slice(1, 3)).toEqual([0, 0]);
  expect(result.later.map((m) => m.position)).not.toEqual(result.first.map((m) => m.position));
  await page.screenshot({ path: 'artifacts/lux-ground-warnings.png' });
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(19);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return { warnings: g.view.luxGroundWarnings.models.size, released: g.world.luxBeams.length };
  });
  expect(end).toEqual({ warnings: 0, released: 1 });
});
