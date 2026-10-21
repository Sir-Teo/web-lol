import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profiles from '../src/content/garen-q-impact-particles.json';
import source from '../docs/reference/garen-q-particles.json';
import audit from '../docs/reference/garen-q-particle-profiles.json';
import reader from '../docs/reference/garen-q-impact-reader.json';
import { garenQImpactParticles } from '../src/render/garen-q-impact-particles';
import type { ChampionState } from '../src/simulation/types';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../src/content/garen-q-audio-timing';

const records: ChampionState['garenQVisuals'] = [
  {
    startTick: 100,
    rank: 1,
    stopTick: 129,
    endReason: 'consumed',
    attacks: [
      {
        startTick: 110,
        releaseTick: 129,
        endTick: 205,
        targetId: 2,
        origin: { x: 0, y: 0 },
        facing: 1,
        stopTick: 130,
        endReason: 'order',
        impact: { tick: 129, point: { x: 100, y: 30 }, facing: 1.2 },
      },
    ],
  },
];
const sample = (age: number) => garenQImpactParticles(1, records, 129 + age);

test('all seven impact color profiles preserve frozen fields, meshes, source absences and pinned reader evidence', () => {
  const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(hash(audit.impactOutput.path)).toBe(audit.impactOutput.sha256);
  expect(hash('docs/reference/garen-q-impact-reader.json')).toBe(audit.impactReaderEvidenceSha256);
  expect(hash('docs/reference/garen-q-cast-reader.json')).toBe(reader.baseEvidenceSha256);
  expect(audit.impactRetentionBoundTicks).toBeLessThan(GAREN_Q_AUDIO_TAIL_TICKS);
  expect(profiles.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  profiles.forEach((p) => {
    const e = source.resources.Garen_Q_Tar.definition.complexEmitterDefinitionData[p.index];
    expect(p.explicitFields).toEqual(Object.keys(e).sort());
    expect(p.rate).toBe(e.rate.constantValue);
    expect(p.emitterLife).toBe(e.lifetime);
    expect(p.life.value).toEqual([e.particleLifetime.constantValue]);
  });
  expect(profiles.filter((p) => p.kind === 'mesh').map((p) => p.mesh)).toEqual(
    Array(2).fill('assets/models/garen-q-impact.glb')
  );
  expect(profiles[3]).toMatchObject({ kind: 'ray', direction: true, bindWeight: null });
  expect(profiles[4]).toMatchObject({
    kind: 'billboard',
    directionScale: 0.008999999612569809,
    directionMinScale: 1,
    atlas: { grid: [2, 2], frames: 1, random: true },
  });
  expect(audit.deferred.find((p) => p.system === 'Garen_Q_Tar')).toEqual({
    system: 'Garen_Q_Tar',
    index: 7,
    reason: 'scene distortion',
  });
});

test('confirmed contact gates first-update births; planned release and pose stops cannot manufacture or cancel impact', () => {
  const noHit = structuredClone(records);
  noHit[0].attacks[0].impact = null;
  expect(garenQImpactParticles(1, noHit, 140)).toEqual([]);
  expect(garenQImpactParticles(1, records, NaN)).toEqual([]);
  expect(sample(-1)).toEqual([]);
  expect(sample(0)).toEqual([]);
  expect(sample(0.99)).toEqual([]);
  expect(profiles.map((_, i) => sample(1).filter((p) => p.profileIndex === i).length)).toEqual([
    1, 1, 2, 2, 2, 1, 2,
  ]);
  const before = sample(7);
  const after = structuredClone(records);
  after[0].attacks[0].endReason = 'death';
  expect(garenQImpactParticles(1, after, 136)).toEqual(before);
  expect(before.every((p) => p.point.x === 100 && p.point.y === 30 && p.facing === 1.2)).toBe(true);
  expect(profiles.map((_, i) => before.filter((p) => p.profileIndex === i).length)).toEqual([
    1, 1, 2, 2, 15, 1, 15,
  ]);
});

test('sparks retain their shared legacy angle/velocity distribution and source-speed stretch; atlas/lookup rolls stay fixed', () => {
  const born = sample(1).find((p) => p.profileIndex === 4 && p.ordinal === 1)!,
    later = sample(7).find((p) => p.profileIndex === 4 && p.ordinal === 1)!;
  const [vx, vy, vz] = born.travel;
  expect(vx).toBe(4);
  expect(Math.atan2(-vy, vz)).toBeGreaterThanOrEqual((-20 * Math.PI) / 180);
  expect(Math.atan2(-vy, vz)).toBeLessThanOrEqual((20 * Math.PI) / 180);
  expect(Math.hypot(vy, vz)).toBeLessThanOrEqual(1200);
  expect(born.offset[1] - 1).toBeCloseTo(vy / 48);
  expect(born.offset[2] - 1).toBeCloseTo(vz / 48);
  later.offset.forEach((v, i) => expect(v - born.offset[i]).toBeCloseTo(born.travel[i] * 0.1));
  expect(born.scale[1]).toBeCloseTo(
    15 * Math.max(1, Math.hypot(...born.travel) * profiles[4].directionScale)
  );
  expect(born.lookup[1]).toBe(later.lookup[1]);
  expect(
    sample(7)
      .filter((p) => [4, 6].includes(p.profileIndex))
      .every((p) => p.frame === 0)
  ).toBe(true);
  expect(
    new Set(Array.from({ length: 20 }, (_, i) => garenQImpactParticles(i, records, 130)[0].frame))
      .size
  ).toBeGreaterThan(1);
  expect(sample(7).find((p) => p.profileIndex === 3)!.scale[1]).toBeGreaterThan(300);
});

test('arbitrary seeks and JSON restore keep every impact finite and deterministic within the retained tail', () => {
  const expected = sample(11.5);
  sample(40);
  expect(garenQImpactParticles(1, JSON.parse(JSON.stringify(records)), 140.5)).toEqual(expected);
  expect(garenQImpactParticles(2, records, 140.5)).not.toEqual(expected);
  for (let age = 1; age < 80; age += 0.5) {
    const particles = sample(age);
    expect(particles.length).toBeLessThanOrEqual(37);
    expect(
      particles
        .flatMap((p) => [...p.offset, ...p.scale, ...p.rotation, ...p.color, ...p.lookup])
        .every(Number.isFinite)
    ).toBe(true);
    expect(particles.every((p) => p.age < p.life && p.age >= 0)).toBe(true);
  }
  expect(sample(audit.impactRetentionBoundTicks)).toEqual([]);
});

test('real lethal contacts and post-contact caster death reload without losing or restarting the visual', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  w.learnSpell('q');
  const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
  target.hp = 1;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  w.step(w.hero.releaseTick! - w.tick + 4);
  expect(target.hp).toBeLessThanOrEqual(0);
  w.damage(target, w.hero, 1e6, 'true');
  const before = garenQImpactParticles(w.hero.id, w.player.garenQVisuals, w.tick);
  expect(before.length).toBeGreaterThan(10);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(
    garenQImpactParticles(restored.hero.id, restored.player.garenQVisuals, restored.tick)
  ).toEqual(before);
  w.step(80);
  restored.step(80);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(
    garenQImpactParticles(restored.hero.id, restored.player.garenQVisuals, restored.tick)
  ).toEqual([]);
});
