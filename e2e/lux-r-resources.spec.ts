import { expect, test } from '@playwright/test';
test('complete Final Spark playback returns to stable geometry and texture counts across repeated casts', async ({
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
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const adapters = [
      'luxBeams',
      'luxStreaks',
      'luxChargeRays',
      'luxBokeh',
      'luxScorches',
      'luxGroundCharge',
      'luxGroundWarnings',
    ];
    const rows = [];
    for (let cast = 0; cast < 6; cast++) {
      w.championState(lux.id).cooldowns.r = 0;
      lux.mana = lux.maxMana;
      w.enqueue({
        type: 'cast',
        unit: lux.id,
        ability: 'r',
        point: { x: 2600, y: cast % 2 ? 1700 : -1700 },
      });
      const phases = [];
      for (const ticks of [30, 12, 25, 20, 90]) {
        w.step(ticks);
        v.render(w, 1, v.previousElapsed);
        phases.push(Object.fromEntries(adapters.map((name) => [name, v[name].models.size])));
      }
      rows.push({
        phases,
        geometries: v.renderer.info.memory.geometries,
        textures: v.renderer.info.memory.textures,
        beams: w.luxBeams.length,
      });
    }
    return rows;
  });
  expect(result).toHaveLength(6);
  for (const row of result) {
    expect(row.phases[0].luxGroundCharge).toBe(14);
    expect(row.phases[0].luxGroundWarnings).toBe(2);
    expect(row.phases[0].luxChargeRays).toBe(1);
    expect(row.phases[2].luxBokeh).toBe(1);
    expect(row.phases[2].luxScorches).toBe(2);
    expect(row.phases[2].luxStreaks).toBe(1);
    expect(Object.values(row.phases.at(-1)!)).toEqual(Array(7).fill(0));
    expect(row.beams).toBe(0);
  }
  expect(new Set(result.slice(1).map((row) => row.geometries)).size).toBe(1);
  expect(new Set(result.slice(1).map((row) => row.textures)).size).toBe(1);
});
