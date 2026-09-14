import { expect, test } from '@playwright/test';

test('charge glows preserve uniform final size, three independent phases and saved playback', async ({
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
    v.center = { x: 0, y: 0 };
    const age = (w.tick - w.championState(lux.id).pendingCast.startTick) / 60;
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      return [...v.luxBeams.models.values()]
        .flatMap((group: any) => group.children)
        .filter((m: any) => ['END_Beam_1', 'END_Beam_Core'].includes(m.name))
        .map((m: any) => ({
          name: m.name,
          visible: m.visible,
          count: m.geometry.drawRange.count,
          positions: Array.from(m.geometry.getAttribute('position').array).slice(0, 54),
          offsets: Array.from(m.geometry.getAttribute('particleMultOffset').array).slice(0, 36),
          scroll: m.material.uniforms.multOffset.value.toArray(),
          rotation: m.material.uniforms.baseRotation.value,
          tint: m.material.uniforms.tint.value.toArray(),
        }));
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    return { age, first, repeat, saved };
  });
  expect(result.first).toHaveLength(2);
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  for (const glow of result.first) {
    expect(glow.visible).toBe(true);
    expect(glow.count).toBe(18);
    expect(glow.rotation).toBeCloseTo(Math.PI / 2, 12);
    const size =
      (glow.name === 'END_Beam_1' ? 100 : 30) *
      (0.800000011920929 + ((1 - 0.800000011920929) * result.age) / 0.949999988079071) *
      0.01;
    const p = glow.positions as number[];
    expect(Math.abs(p[5] - p[2])).toBeCloseTo(2 * size, 5);
    expect(Math.abs(p[6] - p[0])).toBeCloseTo(2 * size, 5);
    expect(new Set([glow.offsets[0], glow.offsets[12], glow.offsets[24]]).size).toBe(3);
    for (const offset of glow.offsets as number[]) {
      expect(offset).toBeGreaterThanOrEqual(-1);
      expect(offset).toBeLessThanOrEqual(1);
    }
    expect(glow.scroll[0]).toBeCloseTo((-result.age * result.age) / (2 * 0.949999988079071), 9);
    expect(glow.scroll[1]).toBe(0);
  }
  await page.screenshot({ path: 'artifacts/lux-charge-glows.png' });
  const shifted = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(12);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.luxBeams.models.values()]
      .flatMap((group: any) => group.children)
      .filter((m: any) => ['END_Beam_1', 'END_Beam_Core'].includes(m.name))
      .map((m: any) => ({
        offsets: Array.from(m.geometry.getAttribute('particleMultOffset').array).slice(0, 36),
        scroll: m.material.uniforms.multOffset.value.toArray(),
      }));
  });
  shifted.forEach((glow, i) => {
    expect(glow.offsets).toEqual(result.first[i].offsets);
    expect(glow.scroll[0]).toBeCloseTo(-((result.age + 0.2) ** 2) / (2 * 0.949999988079071), 9);
  });
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(17);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.luxBeams.models.values()]
      .flatMap((group: any) => group.children)
      .filter((m: any) => ['END_Beam_1', 'END_Beam_Core'].includes(m.name))
      .every((m: any) => !m.visible);
  });
  expect(end).toBe(true);
});
