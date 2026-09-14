import { expect, test } from '@playwright/test';

test('45 streak quads preserve source basis, independent attributes, saves and retirement', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const data = await page.evaluate(async () => {
    const { luxRStreakParticles } = await import('/src/render/lux-r-streak-particles.ts');
    const { default: profile } = await import('/src/content/lux-r-streaks.json');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 2300, y: 1700 } });
    w.step(67);
    v.center = { x: 1300, y: 900 };
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const m = [...v.luxStreaks.models.values()][0] as any;
      return {
        count: m.geometry.drawRange.count,
        pass: m.renderOrder,
        depth: m.material.depthTest,
        ...Object.fromEntries(
          ['position', 'particleColor', 'particleOffset'].map((k) => [
            k,
            Array.from(m.geometry.getAttribute(k).array).slice(
              0,
              m.geometry.drawRange.count * m.geometry.getAttribute(k).itemSize
            ),
          ])
        ),
      };
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const beam = w.luxBeams[0],
      seed =
        beam.sourceId ^
        Math.imul(beam.startTick - 60, 0x9e3779b9) ^
        Math.imul(profile.emitterIndex, 0x85ebca6b),
      particles = luxRStreakParticles(seed, 0.1);
    const p = particles[0],
      length = Math.hypot(2300, 1700),
      forward = [2300 / length, 1700 / length],
      across = [-1700 / length, 2300 / length];
    const expectedCorner = [
      (across[0] * (p.position[0] - p.halfSize[1]) + forward[0] * (p.position[2] + p.halfSize[0])) *
        0.01,
      v.ground(beam.origin) + 0.18 + p.position[1] * 0.01,
      (across[1] * (p.position[0] - p.halfSize[1]) + forward[1] * (p.position[2] + p.halfSize[0])) *
        0.01,
    ];
    w.step(15);
    v.render(w, 1, v.previousElapsed);
    return {
      first,
      repeat,
      saved,
      expectedCorner,
      expectedColor: p.color,
      expectedOffset: p.multOffset,
    };
  });
  expect(data.first.count).toBe(270);
  expect(data.first.pass).toBe(9);
  expect(data.first.depth).toBe(false);
  expect(data.repeat).toEqual(data.first);
  expect(data.saved).toEqual(data.first);
  data.expectedCorner.forEach((v, i) =>
    expect((data.first.position as number[])[i]).toBeCloseTo(v, 5)
  );
  data.expectedColor.forEach((v, i) =>
    expect((data.first.particleColor as number[])[i]).toBeCloseTo(v, 6)
  );
  data.expectedOffset.forEach((v, i) =>
    expect((data.first.particleOffset as number[])[i]).toBeCloseTo(v, 6)
  );
  await page.screenshot({ path: 'artifacts/lux-r-streaks.png' });
  const fog = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      adapter = g.view.luxStreaks;
    const beam = w.luxBeams[0],
      visible = w.pointVisible;
    const before = [...adapter.models.values()][0] as any;
    const positions = Array.from(before.geometry.getAttribute('position').array).slice(
      0,
      before.geometry.drawRange.count * 3
    );
    beam.team = 'red';
    w.pointVisible = (p: any) => p.x > 1500;
    adapter.update(w, 1);
    const partial = [...adapter.models.values()][0] as any;
    const count = partial?.geometry.drawRange.count ?? 0;
    w.pointVisible = () => false;
    adapter.update(w, 1);
    const hidden = adapter.models.size;
    beam.team = 'blue';
    w.pointVisible = visible;
    adapter.update(w, 1);
    const restored = [...adapter.models.values()][0] as any;
    return {
      count,
      hidden,
      restored: positions.every(
        (v, i) => v === restored.geometry.getAttribute('position').array[i]
      ),
    };
  });
  expect(fog.count).toBeGreaterThan(0);
  expect(fog.count).toBeLessThan(270);
  expect(fog.hidden).toBe(0);
  expect(fog.restored).toBe(true);
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(15);
    g.view.render(g.world, 1, g.view.previousElapsed);
    const m = [...g.view.luxStreaks.models.values()][0] as any;
    return m.geometry.drawRange.count;
  });
  expect(tail).toBeGreaterThan(0);
  expect(tail).toBeLessThan(270);
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(14);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return g.view.luxStreaks.models.size;
  });
  expect(end).toBe(0);
});

for (const phase of ['charging', 'fired'])
  test(`streaks ${phase} victory playback has no invented burst and retires`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const data = await page.evaluate((phase) => {
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
      w.step(phase === 'charging' ? 30 : 67);
      v.render(w, 1, v.previousElapsed);
      w.damage(w.hero, target, 1e6, 'true');
      const saved = w.snapshot(),
        start = v.previousElapsed;
      const sample = (age: number) => {
        v.render(w, 1, start + age);
        return [...v.luxStreaks.models.values()].map((m: any) =>
          Array.from(m.geometry.getAttribute('position').array).slice(
            0,
            m.geometry.drawRange.count * 3
          )
        );
      };
      const initial = sample(0),
        later = sample(0.2),
        repeat = sample(0.2),
        expired = sample(1),
        replay = sample(0.2);
      w.step(120);
      return { initial, later, repeat, expired, replay, unchanged: w.snapshot() === saved };
    }, phase);
    expect(data.unchanged).toBe(true);
    expect(data.repeat).toEqual(data.later);
    expect(data.replay).toEqual(data.later);
    expect(data.expired).toEqual([]);
    if (phase === 'charging') {
      expect(data.initial).toEqual([]);
      expect(data.later).toEqual([]);
    } else {
      expect(data.initial.length).toBe(1);
      expect(data.later).not.toEqual(data.initial);
    }
  });
