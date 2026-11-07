import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
  AHRI_R_PREPARED_LAYOUT_PROFILES,
} from '../src/render/ahri-r-particles';

const root = (time: number) => ({
  x: Math.fround(Math.sin(time * 2.1) * 430 + time * 70),
  y: Math.fround(Math.cos(time * 1.3) * 170),
  height: Math.fround(100 + Math.sin(time) * 20),
  facing: time / 3,
});
const context = { boundObjectSize: 100, root };

test('only the ten-second layout quad is selected alongside the four eye profiles', () => {
  expect(AHRI_R_PREPARED_LAYOUT_PROFILES).toEqual([50]);
  expect(AHRI_R_BOUND_BUFF_PROFILES).toEqual([45, 46, 47, 48, 50]);
  const particles = ahriRParticles('Ahri_R_Ready_tar', 927, 1, Infinity, context);
  expect(particles).toHaveLength(1);
  expect(particles[0]).toMatchObject({
    profileIndex: 50,
    ordinal: 1,
    bornTick: 1,
    naturalLife: 10,
    sourceBind: 1,
    bind: 0,
  });
});

test('layout binding preserves every float32 accumulated movement rather than replacing it with an endpoint delta', () => {
  const sum = new Float32Array(3),
    sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, context);
  for (let tick = 1; tick <= 600; tick++) {
    if (tick > 1) {
      const previous = root((tick - 1) / 60),
        current = root(tick / 60);
      sum[0] += current.x - previous.x;
      sum[1] += current.height - previous.height;
      sum[2] += current.y - previous.y;
    }
    const [particle] = sampler.sample(tick / 60);
    expect(particle.worldOffset, `binding update ${tick}`).toEqual([0 - sum[0], sum[1], sum[2]]);
  }
  const start = root(1 / 60),
    end = root(10);
  expect(Array.from(sum)).not.toEqual([
    Math.fround(end.x - start.x),
    Math.fround(end.height - start.height),
    Math.fround(end.y - start.y),
  ]);
  sampler.dispose();
});

test('layout cached fractional, backward and stopped seeks match fresh sampling and drain finitely', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, context);
  for (const time of [0, 1 / 60, 9.99, 0.43, 0.431, 5.25, 10.01, 10.02, 1000000])
    for (const stop of [Infinity, 0, 0.4, 15])
      expect(sampler.sample(time, stop)).toEqual(
        ahriRParticles('Ahri_R_Ready_tar', 927, time, stop, context)
      );
  expect(sampler.cachedBirths).toBeLessThanOrEqual(1);
  expect(sampler.computedBindingSteps).toBeLessThanOrEqual(602);
  expect(sampler.sample(10.02)).toEqual([]);
  expect(sampler.sample(0.4, 0.4)).toEqual([]);
  sampler.dispose();
});

test('expired layout sampling does not request discarded birth poses', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, {
    boundObjectSize: 100,
    root: () => {
      throw Error('Discarded pose');
    },
  });
  expect(sampler.sample(12)).toEqual([]);
  expect(sampler.sample(1000000)).toEqual([]);
  sampler.dispose();
});
