import { expect, test } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
} from '../src/render/ahri-r-particles';
import { SourceEmitterSchedule } from '../src/render/source-emitter-schedule';
const indices = [51, 52, 54];
const context = {
  boundObjectSize: 100,
  root: (time: number) => ({
    x: Math.fround(Math.sin(time) * 150),
    y: Math.fround(time * 40),
    height: 100,
    facing: time / 3,
  }),
};
const meshes = (particles: ReturnType<typeof ahriRParticles>) =>
  particles.filter((p) => indices.includes(p.profileIndex));

test('prepared mesh clocks match complete active-only kernel schedules and preserve their nonuniform gaps', () => {
  const expected = new Map<number, number[]>();
  for (const index of indices) {
    const p = data.profiles[index],
      schedule = new SourceEmitterSchedule({
        rate: p.rate,
        window: {
          lifetime: p.emitterLife,
          particleLifetimeMaximum: 1,
          simple: false,
          singleParticle: false,
          overridesMaterials: false,
          delay: 0,
          emitterLinger: p.emitterLinger ?? 0,
          period: { length: null, active: 30 },
        },
        variableStart: false,
        maxPerFrame: 0,
        segmentLimit: null,
        rateScale: 1,
      }),
      ticks: number[] = [];
    for (let tick = 1; tick <= 32 * 60; tick++)
      for (const _birth of schedule.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0))
        ticks.push(tick);
    expected.set(index, ticks);
  }
  const seen = new Map(indices.map((index) => [index, new Map<number, number>()]));
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, context);
  for (let tick = 1; tick <= 32 * 60; tick++) {
    for (const p of meshes(sampler.sample(tick / 60))) {
      seen.get(p.profileIndex)!.set(p.ordinal, Math.round(p.bornTick));
      expect(p.naturalLife).toBe(1);
      expect(p.sourceBind).toBe(1);
    }
    expect(sampler.cachedBirths).toBeLessThanOrEqual(43);
  }
  for (const index of indices) {
    const births = [...seen.get(index)!].sort(([a], [b]) => a - b);
    expect(births.map(([, tick]) => tick)).toEqual(expected.get(index));
    expect(births.map(([ordinal]) => ordinal)).toEqual(
      Array.from({ length: births.length }, (_, i) => i + 1)
    );
    expect(births.length).toBe(index === 51 ? 120 : 200);
    expect(births.every(([, tick]) => tick < 30 * 60)).toBe(true);
  }
  const alphaTicks = expected.get(51)!;
  expect(alphaTicks.filter((tick, i) => i > 0 && tick - alphaTicks[i - 1] === 16)).toEqual([
    62, 123,
  ]);
  expect([...AHRI_R_BOUND_BUFF_PROFILES].some((index) => indices.includes(index))).toBe(true);
  sampler.dispose();
});

test('cached fractional/backward mesh seeks match fresh packets through active-window closure and stop/linger', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 13, context);
  for (const time of [0.43, 1.5, 29.99, 30, 30.5, 31.1, 15.1, 0.431, 70.25, 1000000.2])
    for (const stop of [Infinity, 0.4, 15]) {
      expect(sampler.sample(time, stop)).toEqual(
        ahriRParticles('Ahri_R_Ready_tar', 13, time, stop, context)
      );
      expect(sampler.cachedBirths).toBeLessThanOrEqual(43);
    }
  expect(meshes(sampler.sample(30)).length).toBeGreaterThan(0);
  expect(meshes(sampler.sample(31.1))).toEqual([]);
  expect(meshes(sampler.sample(16.1, 15))).toEqual([]);
  sampler.dispose();
});

test('cold mesh sampling uses only available recent roots and expired meshes never request old roots', () => {
  for (const time of [15.25, 30.5, 70.25]) {
    const queried: number[] = [];
    const particles = ahriRParticles('Ahri_R_Ready_tar', 927, time, Infinity, {
      boundObjectSize: 100,
      profiles: [51, 52, 53, 54],
      root: (at) => {
        if (at < time - 3) throw Error('Discarded root');
        queried.push(at);
        return context.root(at);
      },
    });
    expect(queried.length).toBeGreaterThan(0);
    expect(Math.min(...queried)).toBeGreaterThan(time - 3);
    if (time < 31) expect(meshes(particles).length).toBeGreaterThan(0);
    else expect(meshes(particles)).toEqual([]);
  }
});
