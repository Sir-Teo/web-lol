import { expect, test } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import { SourceEmitterSchedule } from '../src/render/source-emitter-schedule';
import {
  rLayoutGlowBirthEvents,
  AHRI_R_LAYOUT_GLOW_BIRTH_POLICY as policy,
} from '../src/render/ahri-r-layout-glow-schedule';

function schedule(state?: ConstructorParameters<typeof SourceEmitterSchedule>[1]) {
  const p = data.profiles[53];
  return new SourceEmitterSchedule(
    {
      rate: p.rate,
      window: {
        lifetime: p.emitterLife,
        particleLifetimeMaximum: policy.maximumLife,
        simple: false,
        singleParticle: p.single,
        overridesMaterials: false,
        delay: p.delay,
        emitterLinger: p.emitterLinger ?? 0,
        period: null,
      },
      variableStart: false,
      maxPerFrame: 0,
      segmentLimit: null,
      rateScale: 1,
    },
    state
  );
}

test('bounded glow births match a complete 20,000-second kernel replay across two pool-counter wraps', () => {
  const full = schedule(),
    retained = Math.ceil(policy.maximumLife * 60) + 1;
  let recent: ReturnType<typeof rLayoutGlowBirthEvents> = [],
    count = 0;
  for (let tick = 1; tick <= 20_000 * 60; tick++) {
    const births = full.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0);
    count += births.length;
    for (const birth of births) recent.push({ ...birth, ordinal: tick * 2, updateTick: tick });
    if (births.length) recent = recent.filter((birth) => birth.updateTick >= tick - retained);
    if (tick <= 1000 || tick % 997 === 0 || tick === 20_000 * 60)
      expect(rLayoutGlowBirthEvents(tick)).toEqual(
        recent.filter((birth) => birth.updateTick >= tick - retained)
      );
  }
  expect(count).toBe(150_000);
  expect(full.snapshot().spawned).toBe(count & 0xffff);
});

test('large-clock continuation preserves the induction step and absolute phase at binade boundaries', () => {
  const targets = [
    1,
    60,
    1000,
    ...Array.from({ length: 35 }, (_, i) => 2 ** i),
    policy.maximumUpdateTick - 80,
  ];
  for (const target of targets) {
    const start = 1 + Math.floor((target - 1) / 8) * 8;
    const full = schedule({
      now: start / 60,
      lastSpawn: start / 60,
      emitted: true,
      spawned: 0xffff,
    });
    for (let tick = start + 1; tick <= start + 80; tick++) {
      const births = full.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0);
      expect(births.length, `clock ${tick}`).toBe((tick - start) % 8 === 0 ? 1 : 0);
      if (births.length) expect(births[0]).toMatchObject({ time: tick / 60, share: 1, phase: 0 });
    }
  }
  const error = policy.clockErrorBoundSeconds;
  expect((7 / 60 + error) * 8).toBeLessThan(1);
  expect((8 / 60 - error) * 8).toBeGreaterThan(1);
  expect(policy.nativeConstructorVerified).toBe(false);
});

test('distant and backward seeks retain at most nineteen births without inventing periodic resets', () => {
  for (const tick of [0, 1, 8, 9, 37, 1_000_000 * 60, policy.maximumUpdateTick, 9, 1]) {
    const births = rLayoutGlowBirthEvents(tick);
    expect(births.length).toBeLessThanOrEqual(19);
    expect(new Set(births.map((birth) => birth.ordinal)).size).toBe(births.length);
    for (const birth of births) {
      expect((birth.updateTick - 1) % 8).toBe(0);
      expect(birth.ordinal).toBe(birth.updateTick * 2);
      expect(birth.phase).toBe(0);
    }
  }
  expect(rLayoutGlowBirthEvents(0)).toEqual([]);
  expect(rLayoutGlowBirthEvents(1)[0].updateTick).toBe(1);
});

test('invalid or unsupported numerical seeks fail closed without posing an emitter lifetime', () => {
  for (const tick of [-1, 1.5, NaN, Infinity, policy.maximumUpdateTick + 1])
    expect(() => rLayoutGlowBirthEvents(tick)).toThrow(RangeError);
  expect(policy.cessation).toContain('observed buff producer');
});
