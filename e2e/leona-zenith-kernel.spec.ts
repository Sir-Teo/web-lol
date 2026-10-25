import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Chrome seeks every Zenith family and restores exact source trail geometry without mutating saved gameplay', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const particlePath = '/src/render/leona-zenith-particles.ts',
      historyPath = '/src/render/leona-zenith-history.ts',
      trailPath = '/src/render/leona-zenith-trails.ts',
      fixturePath = '/src/content/practice-fixture.ts';
    const [
      { zenithParticles, ZENITH_PROFILES },
      { zenithDrawGroups },
      { zenithTrailPoints, zenithTrailRibbon },
      { PRACTICE_FIXTURE },
    ] = await Promise.all([
      import(particlePath),
      import(historyPath),
      import(trailPath),
      import(fixturePath),
    ]);
    const w = new g.world.constructor(false, {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => true,
      lineWalkable: () => true,
      reachable: (p: any) => ({ ...p }),
      findPath: (_a: any, b: any) => [{ ...b }],
    });
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
    const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
      target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    w.learnSpell('e', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
    w.step(25);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    const sample = (world: any) =>
      zenithDrawGroups(u.id, world.championState(u.id).leonaEVisuals[0]).map((group: any) => ({
        role: group.role,
        particles: zenithParticles(
          group.role,
          group.seed,
          (world.tick - group.startTick) / 60,
          (group.stopTick - group.startTick) / 60,
          group.radius
        ),
        ribbons: ZENITH_PROFILES.flatMap((p: any, i: number) =>
          p.kind === 'trail'
            ? [
                {
                  index: i,
                  vertices: zenithTrailRibbon(
                    zenithTrailPoints(group, world.tick).filter((q: any) => q.profileIndex === i),
                    p.trail.cutoff
                  ),
                },
              ]
            : []
        ),
      }));
    const original = sample(w),
      restored = sample(copy),
      unchanged = w.snapshot() === saved && copy.snapshot() === saved;
    const phases = [];
    for (const tick of [42, 44, 76]) {
      w.step(tick - w.tick);
      copy.step(tick - copy.tick);
      const a = sample(w),
        b = sample(copy);
      phases.push({ tick, original: a, restored: b, sameSave: w.snapshot() === copy.snapshot() });
    }
    const seen = new Set<number>();
    for (const role of ['weapon', 'dash', 'arrival', 'contact', 'sound'])
      for (const time of [1 / 60, 0.05, 0.1, 0.2, 0.5, 0.8, 1.4])
        for (const p of zenithParticles(role, 17, time)) seen.add(p.profileIndex);
    return {
      schema: JSON.parse(saved).version,
      saved,
      original,
      restored,
      unchanged,
      phases,
      seen: [...seen].sort((a, b) => a - b),
      enabled: ZENITH_PROFILES.length,
    };
  });
  expect(result.schema).toBe(128);
  expect(result.enabled).toBe(20);
  expect(result.seen).toEqual(Array.from({ length: 20 }, (_, i) => i));
  expect(result.unchanged).toBe(true);
  expect(result.restored).toEqual(result.original);
  const ribbons = result.original
    .flatMap((g: any) => g.ribbons)
    .filter((r: any) => r.vertices.length);
  expect(ribbons).toHaveLength(2);
  for (const phase of result.phases) {
    expect(phase.restored).toEqual(phase.original);
    expect(phase.sameSave).toBe(true);
  }
  expect(result.phases.at(-1)!.original.map((g: any) => g.role)).toContain('arrival');
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('evidence.json'), JSON.stringify({ result, errors }, null, 2));
});
