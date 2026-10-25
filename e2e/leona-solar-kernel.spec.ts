import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('Chrome seeks all44 Solar Flare families with explicit orbit inputs and unchanged saved gameplay', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const before = g.world.snapshot(),
      ids = g.world.nextId,
      rng = g.world.random.state;
    const particlePath = '/src/render/leona-solar-particles.ts',
      framePath = '/src/render/leona-solar-frame.ts',
      { solarParticles, SOLAR_PROFILES } = await import(particlePath),
      { solarDrawPoint, solarDrawDirection } = await import(framePath);
    const seen = new Map<number, any>(),
      counts: any[] = [];
    let seeks = 0,
      finite = true,
      repeatable = true,
      stoppedEmpty = true;
    for (const role of ['buff', 'cast', 'contact', 'area-green', 'area-red', 'impact']) {
      let count = 0;
      for (let frame = 1; frame <= 120; frame++) {
        const p = solarParticles(role, 4901, frame / 60);
        seeks++;
        count += p.length;
        repeatable &&= JSON.stringify(p) === JSON.stringify(solarParticles(role, 4901, frame / 60));
        for (const q of p) {
          const point = solarDrawPoint(q, [4, 9, -2], [2, 1, 7]),
            direction = solarDrawDirection(q, q.travel);
          finite &&= [
            ...q.offset,
            ...q.accelerationOffset,
            ...q.size,
            ...q.color,
            ...q.orbitTurn,
            ...point,
            ...direction,
          ].every(Number.isFinite);
          if (!seen.has(q.profileIndex))
            seen.set(q.profileIndex, {
              profile: q.profileIndex,
              name: SOLAR_PROFILES[q.profileIndex].name,
              role,
              particle: q,
              point,
              direction,
            });
        }
      }
      stoppedEmpty &&= solarParticles(role, 4901, 600, 0.25).length === 0;
      counts.push({ role, count });
    }
    const saved = JSON.parse(before),
      restored = g.world.constructor.fromSnapshot(before, g.world.battlefield).snapshot();
    return {
      schema: saved.version,
      ruleset: saved.ruleset,
      profiles: SOLAR_PROFILES.length,
      seeks,
      counts,
      samples: [...seen.values()].sort((a, b) => a.profile - b.profile),
      finite,
      repeatable,
      stoppedEmpty,
      sameSave: g.world.snapshot() === before,
      restoredExactly: restored === before,
      sameIds: g.world.nextId === ids,
      sameRng: g.world.random.state === rng,
    };
  });
  writeFileSync(info.outputPath('solar-kernel.json'), JSON.stringify({ result, errors }, null, 2));
  expect(result.schema).toBe(130);
  expect(result.profiles).toBe(44);
  expect(result.samples).toHaveLength(44);
  expect(result.seeks).toBe(720);
  for (const key of [
    'finite',
    'repeatable',
    'stoppedEmpty',
    'sameSave',
    'restoredExactly',
    'sameIds',
    'sameRng',
  ] as const)
    expect(result[key]).toBe(true);
  expect(result.counts.every((p) => p.count > 0)).toBe(true);
  expect(errors).toEqual([]);
});
