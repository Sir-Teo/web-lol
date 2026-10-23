import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../src/content/garen-aa-particles.json';
import { GAREN_AA_HIT_HISTORY_TICKS } from '../src/content/garen-aa-particle-timing';
import { garenAttackAnimation } from '../src/content/garen-attack-animation';
import { garenAASwingHistoryEnd } from '../src/simulation/garen-aa-presentation';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { garenAAParticles } from '../src/render/garen-aa-particles';

function setup(
  kind: 'attack1' | 'attack2' | 'crit' = 'attack1',
  targetKind: 'champion' | 'melee' = 'champion'
) {
  const w = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => true,
      findPath: (_from, to) => [{ ...to }],
    },
    'garen'
  );
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const target = w.spawn(
    targetKind,
    'red',
    { x: 90, y: 0 },
    targetKind === 'champion' ? 'lux' : undefined
  );
  target.ai = false;
  target.hp = target.maxHp = 1e6;
  if (kind === 'crit') vi.spyOn(w, 'criticalChance').mockReturnValue(1);
  else while (garenAttackAnimation(w.hero.id, w.tick + 1) !== kind) w.step();
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step();
  const r = w.player.garenAAVisuals.at(-1)!;
  expect(r.kind).toBe(kind);
  return { w, target, r };
}
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
test('four graph events and all fourteen frozen emitters retain exact assets, explicit fields and deferred dispatch', () => {
  const source = JSON.parse(readFileSync('docs/reference/garen-aa-particles-source.json', 'utf8'));
  expect(data.events).toHaveLength(4);
  expect(data.events.filter((e) => e.clip === 'crit')).toEqual([]);
  expect(data.profiles).toHaveLength(14);
  expect(data.profiles.filter((p) => !p.deferred)).toHaveLength(12);
  expect(data.profiles.filter((p) => p.deferred).map((p) => [p.system, p.name])).toEqual([
    ['Garen_AA_Crit', 'WeaponTrail'],
    ['Garen_Crit_Tar', 'dist'],
  ]);
  expect(data.hitBone).toBe('C_BUFFBONE_GLB_CHEST_LOC');
  expect(data.orientationType).toBe(2);
  expect(source.assets).toHaveLength(22);
  for (const asset of source.assets) expect(hash(asset.output.file)).toBe(asset.output.sha256);
  expect(hash(source.output.file)).toBe(source.output.sha256);
  expect(hash(source.timing.file)).toBe(source.timing.sha256);
  for (const p of data.profiles) {
    const raw =
      source.definitions.resources[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.explicitFields).toEqual(Object.keys(raw).sort());
    expect(p.rate).toBe(raw.rate.constantValue);
  }
});
test('ordinary swing layers follow the selected clip events, keep their delay and stop before a cancelled event', () => {
  for (const kind of ['attack1', 'attack2'] as const) {
    const { w, r } = setup(kind);
    const seen = new Set<string>();
    for (let tick = r.startTick; tick < r.endTick; tick += 0.5)
      for (const p of garenAAParticles(w.hero.id, [r], tick)) {
        expect(p.bornTick).toBeGreaterThan(r.startTick);
        expect(p.bone).toBe(
          data.profiles[p.profileIndex].system === 'Garen_AA_Sword_Swipe_Front'
            ? 'weapon'
            : 'C_Buffbone_Glb_Center_Loc'
        );
        seen.add(data.profiles[p.profileIndex].system);
        expect(tick).toBeLessThan(garenAASwingHistoryEnd(r) + 1);
      }
    expect(seen).toEqual(
      new Set([
        'Garen_AA_Sword_Swipe_Front',
        kind === 'attack1' ? 'Garen_AA_Atk_01' : 'Garen_AA_Atk_02',
      ])
    );
    w.setOrder(w.hero, { type: 'idle' });
    expect(garenAAParticles(w.hero.id, [r], r.startTick + 15)).toEqual([]);
    expect(r.poseStopReason).toBe('order');
    expect(r.impact).toBeNull();
  }
});
test('accepted normal and critical hits use their own emitter closure without inventing a critical swing event or consuming RNG', () => {
  for (const kind of ['attack1', 'attack2', 'crit'] as const) {
    const { w, r } = setup(kind);
    w.step(r.releaseTick - w.tick + 1);
    const before = w.snapshot(),
      id = w.nextId,
      rng = w.random.state;
    const particles = garenAAParticles(w.hero.id, [r], w.tick);
    const hits = particles.filter((p) => data.profiles[p.profileIndex].phase === 'hit');
    expect(new Set(hits.map((p) => data.profiles[p.profileIndex].system))).toEqual(
      new Set([kind === 'crit' ? 'Garen_Crit_Tar' : 'Garen_AA_Tar'])
    );
    expect(hits.every((p) => p.bone === data.hitBone)).toBe(true);
    expect(particles.some((p) => data.profiles[p.profileIndex].deferred)).toBe(false);
    if (kind === 'crit')
      expect(particles.every((p) => data.profiles[p.profileIndex].phase === 'hit')).toBe(true);
    const later = garenAAParticles(w.hero.id, [r], w.tick + 6.5);
    garenAAParticles(w.hero.id, [r], w.tick + 30);
    expect(garenAAParticles(w.hero.id, [r], w.tick + 6.5)).toEqual(later);
    expect([w.nextId, w.random.state, w.snapshot()]).toEqual([id, rng, before]);
  }
});
test('post-contact pose interruption stops only bound swings while a moving target keeps independent restorable hit poses', () => {
  const { w, target, r } = setup();
  w.step(r.releaseTick - w.tick);
  w.setOrder(w.hero, { type: 'idle' });
  w.setOrder(target, { type: 'move', point: { x: 700, y: 500 } });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < GAREN_AA_HIT_HISTORY_TICKS + 5; i++) {
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(r.cancelTick).toBeNull();
    expect(r.poseStopTick).toBe(r.releaseTick);
    expect(
      garenAAParticles(w.hero.id, [r], w.tick).every(
        (p) => data.profiles[p.profileIndex].phase === 'hit'
      )
    ).toBe(true);
  }
  expect(r.impact!.frames).toHaveLength(GAREN_AA_HIT_HISTORY_TICKS);
  expect(r.impact!.frames.at(-1)!.x).toBeGreaterThan(r.impact!.point.x);
  expect(r.impact!.frames.at(-1)!.animationTimeline!.primary.kind).toBe('run');
});
test('lethal contact finalizes its death pose then freezes through later death placement and target removal', () => {
  const { w, target, r } = setup('attack1', 'melee');
  target.hp = 1;
  w.step(r.releaseTick - w.tick);
  expect(r.impact!.detachedTick).toBe(w.tick);
  expect(r.impact!.frames[0].animationTimeline!.primary.kind).toBe('death');
  w.setOrder(w.hero, { type: 'idle' });
  w.units = w.units.filter((u) => u.id !== target.id);
  const before = structuredClone(r.impact!.frames[0]);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 10; i++) {
    w.step();
    copy.step();
  }
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(
    r
      .impact!.frames.slice(1)
      .every((f) => JSON.stringify({ ...f, tick: before.tick }) === JSON.stringify(before))
  ).toBe(true);
});
test('strict saves reject gaps, crossed stops, unknown historical clips, forged target roots and motion after detachment', () => {
  const { w, r } = setup();
  w.step(r.releaseTick - w.tick + 3);
  w.setOrder(w.hero, { type: 'idle' });
  const good = JSON.parse(w.snapshot());
  for (const mutate of [
    (r: any) => r.frames.shift(),
    (r: any) => r.frames[0].tick++,
    (r: any) => (r.frames[0].animationTimeline.primary.clip = 'absent'),
    (r: any) => (r.poseStopReason = null),
    (r: any) => r.poseStopTick++,
    (r: any) => r.impact.frames.pop(),
    (r: any) => (r.impact.frames[0].audience = ['blue', 'blue']),
    (r: any) => (r.impact.detachedTick = w.tick + 1),
    (r: any) => r.impact.radius++,
    (r: any) => (r.impact.targetTransform = Array(16).fill(1)),
    (r: any) =>
      (r.impact.frames[0].structurePose = { kind: 'idle', clip: 'idle1', time: 0, loop: true }),
  ]) {
    const bad = structuredClone(good);
    mutate(bad.player.garenAAVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('hidden birth positions cannot enter a visible hit tail after the target is revealed again', () => {
  const { w, target, r } = setup('crit');
  w.step(r.releaseTick - w.tick);
  w.setOrder(w.hero, { type: 'idle' });
  const visible = w.visible.bind(w);
  const probe = vi
    .spyOn(w, 'visible')
    .mockImplementation((u, team = 'blue') =>
      u.id === target.id && team === 'blue' ? false : visible(u, team)
    );
  w.setOrder(target, { type: 'move', point: { x: 500, y: 500 } });
  w.step(8);
  expect(r.impact!.audience).toContain('blue');
  expect(r.impact!.frames.slice(1).every((f) => !f.audience.includes('blue'))).toBe(true);
  probe.mockRestore();
  w.step();
  expect(r.impact!.frames.at(-1)!.audience).toContain('blue');
  expect(garenAAParticles(w.hero.id, [r], w.tick).length).toBeGreaterThan(0);
  expect(garenAAParticles(w.hero.id, [r], w.tick, 'blue')).toEqual([]);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(10);
  copy.step(10);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('known unbound births can finish without tracking hidden attachment frames or accepting later unseen births', () => {
  const { w, target, r } = setup();
  w.step(r.releaseTick - w.tick + 2);
  w.setOrder(w.hero, { type: 'idle' });
  const lastKnown = w.tick,
    visible = w.visible.bind(w),
    probe = vi
      .spyOn(w, 'visible')
      .mockImplementation((u, team = 'blue') =>
        u.id === target.id && team === 'blue' ? false : visible(u, team)
      );
  w.step(5);
  const hidden = garenAAParticles(w.hero.id, [r], w.tick, 'blue').filter(
    (p) => data.profiles[p.profileIndex].phase === 'hit'
  );
  expect(hidden.length).toBeGreaterThan(0);
  expect(
    hidden.every((p) => p.bornTick <= lastKnown && data.profiles[p.profileIndex].bindWeight === 0)
  ).toBe(true);
  probe.mockRestore();
  w.step();
  const revealed = garenAAParticles(w.hero.id, [r], w.tick, 'blue').filter(
    (p) => data.profiles[p.profileIndex].phase === 'hit'
  );
  expect(revealed.every((p) => p.bornTick <= lastKnown)).toBe(true);
});
