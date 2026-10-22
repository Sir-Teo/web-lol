import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profiles from '../src/content/garen-q-ground-particles.json';
import source from '../docs/reference/garen-q-particles.json';
import assets from '../docs/reference/garen-q-particles-decoded.json';
import audit from '../docs/reference/garen-q-particle-profiles.json';
import { garenQGroundMotion, garenQGroundParticles } from '../src/render/garen-q-ground-particles';
import { garenQLandingTick } from '../src/content/garen-q-presentation';
import { garenQAttackTimingAtLevel } from '../src/simulation/garen-attack-timing';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../src/content/garen-q-audio-timing';
import type { ChampionState } from '../src/simulation/types';
import { World } from '../src/simulation/world';
import { SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const records: ChampionState['garenQVisuals'] = [
  {
    startTick: 1,
    rank: 1,
    stopTick: null,
    endReason: null,
    attacks: [
      {
        startTick: 10,
        releaseTick: 30,
        endTick: 110,
        targetId: 2,
        origin: { x: 0, y: 0 },
        facing: 0,
        stopTick: null,
        endReason: null,
        impact: null,
        landing: { tick: 28, point: { x: 40, y: 20 }, facing: 0.6 },
        silenceEndTick: null,
      },
    ],
  },
];
function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  w.learnSpell('q');
  const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  const attack = w.player.garenQVisuals[0].attacks[0];
  return { w, target, attack, event: garenQLandingTick(attack) };
}

test('five ground profiles retain complete fields, source absent jump frame/bones, landing frame 9 and non-kill flags', () => {
  const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(hash(audit.groundOutput.path)).toBe(audit.groundOutput.sha256);
  expect(hash('docs/reference/garen-q-ground-reader.json')).toBe(audit.groundReaderEvidenceSha256);
  expect(audit.implemented).toHaveLength(22);
  expect(audit.deferred).toHaveLength(9);
  expect(audit.groundRetentionBoundTicks).toBeLessThan(GAREN_Q_AUDIO_TAIL_TICKS);
  for (let level = 1; level <= 18; level++)
    expect(
      garenQAttackTimingAtLevel(level).windupTicks + audit.groundRetentionBoundTicks
    ).toBeLessThan(GAREN_Q_AUDIO_TAIL_TICKS);
  profiles.forEach((p) => {
    const e = (source.resources as any)[p.system].definition.complexEmitterDefinitionData[p.index];
    const event = Object.values(assets.animationParticleEvents).find(
      (v) => v.mEffectKey === p.system
    )!;
    expect(p.explicitFields).toEqual(Object.keys(e).sort());
    expect(p.eventFrame).toBe('mStartFrame' in event ? event.mStartFrame : null);
    expect(p.eventBone).toBe(null);
    expect(p.killEvent).toBe(false);
    expect(p.loop).toBe(false);
    expect(p.count).toBe(e.rate.constantValue);
    expect(p.emitterLife).toBe(e.lifetime);
  });
  expect(profiles.map((p) => p.uvMode)).toEqual([2, 2, 2, 2, 0]);
  expect(garenQLandingTick({ startTick: 100, releaseTick: 120 })).toBe(118);
  expect(profiles[4].lookup).toBe(null); // Authored empty string, not an invented lookup.
  expect(profiles[3].spawnAxes).toHaveLength(2);
});

test('ground motion matches ten independent Euler drag steps and interpolates their displacement; world acceleration is draw-time', () => {
  let speed = 1100,
    distance = 0;
  for (let i = 0; i < 10; i++) {
    speed -= (speed * 5) / 60;
    distance += speed / 60;
  }
  const motion = garenQGroundMotion([1100, 0, 0], [5, 5, 5], [0, -20, 0], 0.4, 10 / 60);
  expect(motion.offset[0]).toBeCloseTo(distance, 10);
  expect(motion.offset[1]).toBeCloseTo((-20 * 0.4 * 10) / 60, 10);
  const half = garenQGroundMotion([1100, 0, 0], [5, 5, 5], [0, 0, 0], 0.4, 10.5 / 60);
  expect(half.offset[0]).toBeCloseTo(distance + (speed * (1 - 5 / 60)) / 120, 10);
  expect(garenQGroundMotion([0, 10, 0], [0, 0, 0], [0, 30, 0], 0.3, 0.1).offset).toEqual([
    0, 1.9, 0,
  ]);
});

test('event-owned singles use source burst counts and absolute delay eligibility; absent landing never emits from planned release', () => {
  const sample = (tick: number) => garenQGroundParticles(1, records, tick);
  expect(sample(10)).toEqual([]);
  expect(sample(11)).toHaveLength(2);
  expect(sample(28).every((p) => p.profileIndex === 0)).toBe(true);
  expect(profiles.map((_, i) => sample(29).filter((p) => p.profileIndex === i).length)).toEqual([
    2, 40, 5, 20, 0,
  ]);
  expect(sample(34).filter((p) => p.profileIndex === 4)).toHaveLength(3);
  expect(
    sample(34)
      .filter((p) => p.profileIndex === 4)
      .every((p) => p.age === 0 && p.bornTick === 34)
  ).toBe(true);
  const cancelled = structuredClone(records);
  cancelled[0].attacks[0].landing = null;
  expect(garenQGroundParticles(1, cancelled, 35)).toEqual([]);
  expect(garenQGroundParticles(1, records, NaN)).toEqual([]);
});

test('ground singles outlive pose stops, preserve composed legacy turns and deterministic finite motion through arbitrary seeks', () => {
  const stopped = structuredClone(records);
  stopped[0].attacks[0].stopTick = 29;
  stopped[0].attacks[0].endReason = 'death';
  const first = garenQGroundParticles(1, records, 35.5);
  expect(garenQGroundParticles(1, stopped, 35.5)).toEqual(first);
  const smoke = garenQGroundParticles(1, records, 29).find((p) => p.profileIndex === 3)!;
  // Shared chance gives Z=a, then Y=-a; right composition applies Y first.
  const angle = smoke.rotation[0] - 1,
    chance = angle / 359,
    a = chance * 2 * Math.PI,
    x = 40 * (0.6 + 0.4 * chance) * Math.cos(a),
    y = 20,
    z = 40 * (0.6 + 0.4 * chance) * Math.sin(a);
  expect(smoke.offset[0]).toBeCloseTo(x * Math.cos(a) - y * Math.sin(a));
  expect(smoke.offset[1]).toBeCloseTo(x * Math.sin(a) + y * Math.cos(a));
  expect(smoke.offset[2]).toBeCloseTo(z);
  garenQGroundParticles(2, records, 100);
  expect(garenQGroundParticles(1, JSON.parse(JSON.stringify(records)), 35.5)).toEqual(first);
  for (let tick = 11; tick < 150; tick += 2.5) {
    const ps = garenQGroundParticles(1, records, tick);
    expect(ps.length).toBeLessThanOrEqual(70);
    expect(
      ps
        .flatMap((p) => [
          ...p.offset,
          ...p.scale,
          ...p.color,
          ...p.lookup,
          ...p.scroll,
          ...p.travel,
        ])
        .every(Number.isFinite)
    ).toBe(true);
  }
  expect(garenQGroundParticles(1, records, 28 + audit.groundRetentionBoundTicks)).toEqual([]);
});

test('landing captures the event-time caster point/heading instead of commitment or later root, and reload continues exactly', () => {
  const { w, target, attack, event } = setup();
  w.step(event - w.tick - 1);
  expect(attack.landing).toBe(null);
  Object.assign(w.hero, { x: 40, y: 20, previous: { x: 40, y: 20 } });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  restored.step();
  expect(attack.landing).toEqual({
    tick: event,
    point: { x: 40, y: 20 },
    facing: Math.atan2(target.x - 40, target.y - 20),
  });
  expect(restored.snapshot()).toBe(w.snapshot());
  const fixed = structuredClone(attack.landing);
  Object.assign(w.hero, { x: 1000, y: 2000, previous: { x: 1000, y: 2000 } });
  w.setOrder(w.hero, { type: 'move', point: { x: 1200, y: 2000 } });
  w.step(40);
  expect(attack.landing).toEqual(fixed);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('target loss before the event suppresses landing; loss/death after dispatch retains finite one-shot history including same-tick death', () => {
  for (const after of [false, true]) {
    const { w, target, attack, event } = setup();
    w.step(event - w.tick - (after ? 0 : 1));
    w.damage(w.hero, target, 1e6, 'true');
    w.step();
    expect(attack.landing !== null).toBe(after);
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  }
  const { w, attack, event } = setup();
  w.step(event - w.tick);
  w.damage(w.hero, w.hero, 1e6, 'true');
  expect(attack.stopTick).toBe(event);
  expect(attack.landing?.tick).toBe(event);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step(100);
  expect(garenQGroundParticles(w.hero.id, w.player.garenQVisuals, w.tick)).toEqual([]);
});

test('current schema rejects missing, future, wrong-frame, malformed and obligatorily absent landing anchors', () => {
  const { w, event } = setup(),
    early = JSON.parse(w.snapshot());
  const attack = (s: any) => s.player.garenQVisuals[0].attacks[0];
  for (const mutate of [
    (s: any) => delete attack(s).landing,
    (s: any) => (attack(s).landing = { tick: event, point: { x: 0, y: 0 }, facing: 0 }),
  ]) {
    const s = structuredClone(early);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(event - w.tick);
  const late = JSON.parse(w.snapshot());
  expect(late.version).toBe(SNAPSHOT_VERSION);
  for (const mutate of [
    (s: any) => (attack(s).landing = null),
    (s: any) => attack(s).landing.tick++,
    (s: any) => attack(s).landing.tick--,
    (s: any) => delete attack(s).landing.point,
    (s: any) => (attack(s).landing.extra = true),
  ]) {
    const s = structuredClone(late);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});
