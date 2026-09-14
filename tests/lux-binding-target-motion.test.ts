import { expect, test } from 'vitest';
import {
  luxBindingTargetBirth,
  luxBindingTargetBirths,
} from '../src/render/lux-binding-target-births';
import { luxBindingTargetStaticMotion as motion } from '../src/render/lux-binding-target-motion';

const births = luxBindingTargetBirths(7, 1 / 60);
function particle(name: string, chance = 0) {
  const p = births.find((p) => p.name === name)!;
  return { ...p, ...luxBindingTargetBirth(p.profileIndex, chance) };
}

test('point shapes retain authored vertical separation without applying particle spin to placement', () => {
  const heights: Record<string, number> = {
    blastring: 50,
    orbitrunes: 0,
    orbitcap1: 230,
    fireCircleTimer: 0,
    fireCircleTimer1: 230,
    Constelations: 10,
    Constelations1: 230,
    up_glow: 0,
    up_glow1: -10,
  };
  for (const [name, height] of Object.entries(heights)) {
    const p = particle(name, 0.75);
    const result = motion({ ...p, age: p.life * 0.7 })!;
    expect(result.position).toEqual([0, height, 0]);
    expect(result.velocity).toEqual([0, 0, 0]);
  }
});

test('bars occupy the source radius at cardinal spawn angles', () => {
  for (const [chance, expected] of [
    [0, [80, 130, 0]],
    [0.25, [0, 130, -80]],
    [0.5, [-80, 130, 0]],
    [0.75, [0, 130, 80]],
  ] as const) {
    const result = motion({ ...particle('bars', chance), age: 0.2 })!;
    result.position.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));
  }
});

test('spark spawn rotation turns its velocity, then translates and advances in seconds', () => {
  // Chance .25 yields a 90-degree Y turn and birth velocity [-5,-52,-5].
  const p = { ...particle('energy_Float', 0.25), age: 0.5 };
  const result = motion(p)!;
  result.velocity.forEach((v, i) => expect(v).toBeCloseTo([-5, -52, 5][i], 5));
  result.position.forEach((v, i) => expect(v).toBeCloseTo([-2.5, 75, -0.5][i], 5));
  result.displacement.forEach((v, i) => expect(v).toBeCloseTo([-2.5, -26, 2.5][i], 5));
});

test('motion is seekable, leaves births unchanged and excludes expired particles', () => {
  const p = { ...particle('energy_Float', 0.6), age: 0.2 };
  const before = JSON.stringify(p),
    first = motion(p);
  motion({ ...p, age: 0.4 });
  expect(motion(p)).toEqual(first);
  expect(JSON.stringify(p)).toBe(before);
  for (const age of [-1, NaN, Infinity, p.life]) expect(motion({ ...p, age })).toBeNull();
});
