import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
} from '../src/render/ahri-r-particles';

const root = (time: number) => ({
  x: Math.fround(Math.sin(time * 2.1) * 430 + time * 70),
  y: Math.fround(Math.cos(time * 1.3) * 170),
  height: Math.fround(100 + Math.sin(time) * 20),
  facing: time / 3,
});
const context = { boundObjectSize: 100, root };
const base = (particles: ReturnType<typeof ahriRParticles>) =>
  particles.filter((p) => p.profileIndex === 49);

test('the selected sixty-second base preserves every float32 binding update', () => {
  expect([...AHRI_R_BOUND_BUFF_PROFILES]).toContain(49);
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, context);
  const sum = new Float32Array(3);
  for (let tick = 1; tick <= 3600; tick++) {
    if (tick > 1) {
      const a = root((tick - 1) / 60),
        b = root(tick / 60);
      sum[0] += b.x - a.x;
      sum[1] += b.height - a.height;
      sum[2] += b.y - a.y;
    }
    const particles = base(sampler.sample(tick / 60));
    expect(particles).toHaveLength(1);
    expect(particles[0]).toMatchObject({ bornTick: 1, naturalLife: 60, sourceBind: 1, bind: 0 });
    expect(particles[0].worldOffset, `binding update ${tick}`).toEqual([
      0 - sum[0],
      sum[1],
      sum[2],
    ]);
  }
  const a = root(1 / 60),
    b = root(60);
  expect(Array.from(sum)).not.toEqual([
    Math.fround(b.x - a.x),
    Math.fround(b.height - a.height),
    Math.fround(b.y - a.y),
  ]);
  expect(sampler.cachedBirths).toBeLessThanOrEqual(43);
  sampler.dispose();
});

test('cold, fractional and backward base seeks match cached packets and actual stops remove it immediately', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 13, context);
  for (const time of [0, 1 / 60, 59.99, 0.43, 30.123, 60.01, 60.02, 70.25])
    for (const stop of [Infinity, 0.4, 15]) {
      expect(base(sampler.sample(time, stop))).toEqual(
        base(ahriRParticles('Ahri_R_Ready_tar', 13, time, stop, context))
      );
      if (time >= stop) expect(base(sampler.sample(time, stop))).toEqual([]);
    }
  expect(base(sampler.sample(60.01))).toHaveLength(1);
  expect(base(sampler.sample(60.02))).toEqual([]);
  sampler.dispose();
});

test('a cold live base requires its complete saved path, while an expired base never requests discarded birth poses', () => {
  const queried: number[] = [];
  const particles = base(
    ahriRParticles('Ahri_R_Ready_tar', 927, 59.99, Infinity, {
      boundObjectSize: 100,
      root: (time) => {
        queried.push(time);
        return root(time);
      },
    })
  );
  expect(particles).toHaveLength(1);
  expect(Math.min(...queried)).toBeCloseTo(1 / 60, 12);
  expect(queried.some((time) => time > 59)).toBe(true);
  for (const now of [60.05, 70.25]) {
    expect(
      base(
        ahriRParticles('Ahri_R_Ready_tar', 927, now, Infinity, {
          boundObjectSize: 100,
          root: (time) => {
            if (time < now - 12) throw Error('Discarded pose');
            return root(time);
          },
        })
      )
    ).toEqual([]);
  }
});

test('explicit producer subsets avoid unselected roots and preserve selected packets', () => {
  const time = 29.5;
  const expected = ahriRParticles('Ahri_R_Ready_tar', 927, time, Infinity, context).filter(
    (p) => p.profileIndex !== 49
  );
  const selected = ahriRParticles('Ahri_R_Ready_tar', 927, time, Infinity, {
    boundObjectSize: 100,
    profiles: [50, 51, 52, 53, 54],
    root: (at) => {
      if (at < time - 3) throw Error('Unselected base queried an old pose');
      return root(at);
    },
  });
  expect(selected).toEqual(expected);
  expect(
    ahriRParticles('Ahri_R_Ready_tar', 927, time, Infinity, {
      boundObjectSize: 100,
      profiles: [],
      root: () => {
        throw Error('Empty selection queried a pose');
      },
    })
  ).toEqual([]);
});
