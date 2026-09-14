import { expect, it } from 'vitest';
import { luxEmissionCount, luxEmissionBirthTick } from '../src/content/lux-emission';
import { luxCrescentParticles } from '../src/render/lux-crescent-particles';
import { luxTrailParticles } from '../src/render/lux-trail-particles';
import { luxHoopParticles } from '../src/render/lux-hoop-particles';
import type { LuxAttackVisual } from '../src/simulation/types';

it('matches an independent integer-credit stepper including the charged first birth', () => {
  for (const rate of [20, 50, 200]) {
    let credit = 0,
      total = 0;
    const births: number[] = [];
    for (let tick = 1; tick <= 600; tick++) {
      credit += rate;
      const count = Math.max(tick === 1 ? 1 : 0, Math.floor(credit / 60));
      credit -= count * 60;
      total += count;
      for (let n = 0; n < count; n++) births.push(tick);
      expect(luxEmissionCount(rate, tick, 10)).toBe(total);
    }
    births.forEach((tick, i) => expect(luxEmissionBirthTick(rate, i + 1)).toBe(tick));
    expect(luxEmissionCount(rate, 0, 10)).toBe(0);
  }
  expect([1, 2, 3, 4].map((ordinal) => luxEmissionBirthTick(20, ordinal))).toEqual([1, 6, 9, 12]);
  expect([1, 2, 3, 4].map((ordinal) => luxEmissionBirthTick(50, ordinal))).toEqual([1, 3, 4, 5]);
});
it('distinguishes inclusive emitter duration from a non-emitting stopped update', () => {
  expect(luxEmissionCount(20, 18, 0.30000001192092896)).toBe(6);
  expect(luxEmissionCount(20, 18, 0.30000001192092896, 18)).toBe(5);
  expect(luxEmissionCount(50, 3, 1, 3)).toBe(1);
  expect(luxEmissionCount(50, 3, 1, 3.5)).toBe(2);
  expect(luxEmissionCount(20, 1, 1, 1)).toBe(0);
  expect(luxEmissionCount(20, 10, 0)).toBe(0);
  expect(luxEmissionCount(20, 10, 1, 0)).toBe(0);
});
it('gives actual low-rate emitters a first-update particle but no impact-update births', () => {
  const effect: LuxAttackVisual = {
    id: 42,
    sourceId: 1,
    team: 'blue',
    origin: { x: 0, y: 0 },
    launchTick: 0,
    stopTick: null,
    frames: [
      { tick: 0, x: 0, y: 0, facing: 0, trailDistance: 0 },
      { tick: 1, x: 10, y: 0, facing: 0, trailDistance: 0 },
    ],
  };
  expect(luxCrescentParticles(effect, 1).map((p) => p.birthTick)).toEqual([1]);
  expect(luxTrailParticles(effect, 1).map((p) => p.birthTick)).toEqual([1]);
  expect(luxHoopParticles(42, 1 / 60).map((p) => p.birthTick)).toEqual([1, 1, 1]);
  effect.stopTick = 1;
  expect(luxCrescentParticles(effect, 1)).toEqual([]);
  expect(luxTrailParticles(effect, 1)).toEqual([]);
  expect(luxHoopParticles(42, 1 / 60, 1 / 60)).toEqual([]);
});
