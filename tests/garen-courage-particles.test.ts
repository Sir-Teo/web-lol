import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profiles from '../src/content/garen-w-particles.json';
import audit from '../docs/reference/garen-w-particle-profiles.json';
import source from '../docs/reference/garen-w-particles.json';
import { GAREN_W_DEFLECT_TAIL_TICKS } from '../src/content/garen-w-particle-timing';
import {
  garenCourageParticles,
  garenCourageDeflectParticles,
} from '../src/render/garen-courage-particles';
import { GAREN_W_AUDIO_TAIL_TICKS } from '../src/content/garen-w-audio-timing';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const effect = { startTick: 100, stopTick: null, endReason: null };
test('Courage playback retains verified source/default pins and accounts for every selected/deferred declaration', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(hash(audit.output.path)).toBe(audit.output.sha256);
  expect(hash(audit.timingOutput.path)).toBe(audit.timingOutput.sha256);
  expect(hash('docs/reference/garen-w-particles.json')).toBe(audit.sourcePinSha256);
  expect(hash('docs/reference/garen-w-particles-decoded.json')).toBe(audit.decodedAssetsSha256);
  expect(hash('docs/reference/garen-spin-defaults.json')).toBe(audit.defaultsEvidenceSha256);
  expect(profiles).toHaveLength(12);
  expect(audit.deferred).toHaveLength(8);
  expect(profiles.map((p) => [p.role, p.index])).toEqual([
    ['cast', 0],
    ['cast', 1],
    ['cast', 2],
    ['cast', 3],
    ['buff', 0],
    ['buff', 1],
    ['buff', 2],
    ['shoulder-left', 0],
    ['shoulder-left', 1],
    ['shoulder-right', 0],
    ['shoulder-right', 1],
    ['deflect', 0],
  ]);
  expect(
    new Set([...audit.implemented, ...audit.deferred].map((p) => `${p.system}:${p.index}`)).size
  ).toBe(20);
  expect(profiles[0].life.value).toEqual([2.25]);
  expect(profiles[0].lingerType).toBe(1);
  expect(profiles[4].life.value).toEqual([6]);
  expect(profiles[6].emitterLife).toBeNull();
});
test('Courage emits the declared bursts and first rate-budget births without inventing late or pre-cast particles', () => {
  expect(garenCourageParticles(1, effect, 99)).toEqual([]);
  expect(garenCourageParticles(1, effect, NaN)).toEqual([]);
  expect(garenCourageParticles(1, effect, 100)).toEqual([]);
  const born = garenCourageParticles(1, effect, 101);
  expect(profiles.map((_, i) => born.filter((p) => p.profileIndex === i).length)).toEqual([
    1, 2, 1, 1, 2, 1, 1, 10, 1, 10, 1, 0,
  ]);
  expect(born.every((p) => p.age === 0)).toBe(true);
  expect(born.find((p) => p.profileIndex === 0)!.offset).toEqual([0, -10, 0]);
  expect(born.find((p) => p.profileIndex === 1)!.offset).toEqual([0, 100, -50]);
  expect(garenCourageParticles(1, effect, 1000)).toEqual([]);
});
test('Courage shoulder profiles preserve the frozen source curves and differing emitter definitions', () => {
  for (const system of ['Garen_W_Shoulder_L', 'Garen_W_Shoulder_R'] as const) {
    const emitters = source.resources[system].definition.complexEmitterDefinitionData;
    for (const [index, e] of emitters.entries()) {
      const p = profiles.find((p) => p.system === system && p.index === index)!;
      expect(p.rate).toBe(e.rate.constantValue);
      expect(p.life.value).toEqual([e.particleLifetime.constantValue]);
      expect(p.linger).toBe(e.particleLinger);
      expect(p.emitterLife).toBe(e.lifetime);
      expect(p.particleLocal).toBe(!!e.particleIsLocalOrientation);
      expect(p.size.value).toEqual(e.birthScale0.constantValue);
      if (e.scale0) {
        expect(p.scale).toEqual({
          times: e.scale0.dynamics.times,
          values: e.scale0.dynamics.values,
        });
        expect(p.size.probabilities!.map((p) => [p.times, p.values])).toEqual(
          e.birthScale0.dynamics!.probabilityTables.map((p) => [p.keyTimes, p.keyValues])
        );
      }
    }
  }
  expect(profiles[7].scale).not.toEqual(profiles[9].scale);
});
test('Courage source motion, angular velocity, UV offset and independently randomized lookup remain finite and deterministic', () => {
  const snapshot = garenCourageParticles(1, effect, 130);
  garenCourageParticles(1, effect, 240);
  expect(garenCourageParticles(1, JSON.parse(JSON.stringify(effect)), 130)).toEqual(snapshot);
  expect(garenCourageParticles(2, effect, 130)).not.toEqual(snapshot);
  const waves = garenCourageParticles(1, effect, 145).filter((p) => p.profileIndex === 6);
  expect(new Set(waves.map((p) => p.lookup[1])).size).toBeGreaterThan(1);
  const symbol = garenCourageParticles(1, effect, 130).find((p) => p.profileIndex === 5)!;
  expect(symbol.offset[1]).toBeCloseTo((2 * 29) / 60);
  expect(symbol.offset[2]).toBe(10);
  for (let tick = 101; tick < 400; tick += 0.5) {
    const sampled = garenCourageParticles(1, effect, tick);
    expect(sampled.length).toBeLessThan(95);
    expect(
      sampled
        .flatMap((p) => [
          ...p.offset,
          ...p.scale,
          ...p.rotation,
          ...p.color,
          ...p.scroll,
          ...p.lookup,
        ])
        .every(Number.isFinite)
    ).toBe(true);
  }
});
test('Courage shoulders retain asymmetric source bursts, rates, bone-local orientation and natural tails', () => {
  const shoulders = (tick: number, stopped: Parameters<typeof garenCourageParticles>[1] = effect) =>
    garenCourageParticles(1, stopped, tick).filter((p) => p.profileIndex >= 7);
  const first = shoulders(101);
  expect(first).toHaveLength(22);
  expect(first.filter((p) => p.profileIndex === 7).every((p) => p.scale[0] === 0)).toBe(true);
  expect(profiles.slice(7, 11).every((p) => p.particleLocal && p.kind === 'billboard')).toBe(true);
  expect(first.find((p) => p.profileIndex === 8)!.offset).toEqual([6, -19, 6]);
  expect(first.find((p) => p.profileIndex === 10)!.offset).toEqual([6, -9, 6]);
  expect(first.find((p) => p.profileIndex === 8)!.rotation).toEqual([90, 0, 90]);
  expect(first.find((p) => p.profileIndex === 10)!.rotation).toEqual([90, 30, -60]);
  const second = shoulders(130);
  expect(second.filter((p) => p.profileIndex === 8)).toHaveLength(1);
  expect(second.filter((p) => p.profileIndex === 10)).toHaveLength(2);
  expect(new Set(second.filter((p) => p.profileIndex === 7).map((p) => p.scale[0])).size).toBe(10);
  // Early death stops future hoop/glint births; existing one-second particles
  // finish naturally even though their authored linger is eleven seconds.
  const stopped = { ...effect, stopTick: 115, endReason: 'death' as const };
  expect(shoulders(130, stopped).filter((p) => p.profileIndex === 10)).toHaveLength(1);
  expect(shoulders(160)).toHaveLength(25);
  expect(shoulders(161, stopped)).toEqual([]);
  expect(shoulders(219)).toHaveLength(1);
  expect(shoulders(220)).toEqual([]);
});
test('Courage damage reactions retain the independent rotating source mesh and bounded natural life', () => {
  const reactions = [
    { tick: 100, castTick: 1 },
    { tick: 110, castTick: 1 },
  ];
  expect(garenCourageDeflectParticles(1, reactions, 100)).toEqual([]);
  const born = garenCourageDeflectParticles(1, reactions, 101);
  expect(born).toHaveLength(1);
  expect(born[0]).toMatchObject({ startTick: 100, profileIndex: 11, offset: [0, -10, 0] });
  const p = profiles[11],
    e = source.resources.Garen_W_Deflect.definition.complexEmitterDefinitionData[0];
  expect(p.life.value).toEqual([e.particleLifetime.constantValue]);
  expect(p.angularVelocity.value).toEqual(e.birthRotationalVelocity0.constantValue);
  expect(p.scale).toEqual({ times: e.scale0.dynamics.times, values: e.scale0.dynamics.values });
  expect(p.local).toBe(false);
  const at = garenCourageDeflectParticles(1, reactions, 131);
  expect(at).toHaveLength(2);
  expect(at[0].rotation).toEqual([0, 110, 0]);
  expect(at[0].color).toEqual([1, 1, 1, e.Color.constantValue[3]]);
  expect(at[0].scale[1]).toBeCloseTo(
    e.birthScale0.constantValue[1] * e.scale0.dynamics.values[1][1]
  );
  expect(garenCourageDeflectParticles(1, reactions.slice(0, 1), 149)).toHaveLength(1);
  expect(garenCourageDeflectParticles(1, reactions.slice(0, 1), 150)).toEqual([]);
  expect(garenCourageDeflectParticles(1, reactions, 110 + GAREN_W_DEFLECT_TAIL_TICKS)).toEqual([]);
});
test('Courage stops further births, caps total age by source linger and retains natural color/scale phase', () => {
  const stopped = { ...effect, stopTick: 130, endReason: 'death' as const };
  expect(garenCourageParticles(1, { ...stopped, stopTick: 100 }, 101)).toEqual([]);
  const particles = garenCourageParticles(1, stopped, 130);
  expect(particles.some((p) => p.profileIndex === 0)).toBe(true);
  expect(particles.some((p) => p.profileIndex === 4 || p.profileIndex === 5)).toBe(false);
  const activeAt130 = garenCourageParticles(1, effect, 130);
  for (const p of particles)
    expect(p).toEqual(
      activeAt130.find((a) => a.profileIndex === p.profileIndex && a.ordinal === p.ordinal)
    );
  expect(garenCourageParticles(1, stopped, 130 + GAREN_W_AUDIO_TAIL_TICKS)).toEqual([]);
  const ended = { ...effect, stopTick: 340, endReason: 'expired' as const };
  expect(garenCourageParticles(1, ended, 339).some((p) => p.profileIndex === 4)).toBe(true);
  expect(garenCourageParticles(1, ended, 340).every((p) => p.profileIndex === 6)).toBe(true);
  expect(garenCourageParticles(1, ended, 348)).toEqual([]);
});
test('Courage active and early-death particles reconstruct from existing schema-80 history without changing simulation RNG', () => {
  for (const death of [false, true]) {
    const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.hero.previous = { x: 0, y: 0 };
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(20);
    if (death) w.damage(w.hero, w.hero, 1e6, 'true');
    const saved = w.snapshot(),
      restored = World.fromSnapshot(saved, w.battlefield);
    const sample = (x: World) => garenCourageParticles(x.hero.id, x.player.garenWVisual!, x.tick);
    expect(sample(restored)).toEqual(sample(w));
    expect(w.snapshot()).toBe(saved);
    w.step(25);
    restored.step(25);
    expect(sample(restored)).toEqual(sample(w));
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});
