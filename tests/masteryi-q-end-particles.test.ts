import { expect, test } from 'vitest';
import data from '../src/content/masteryi-q-end-particles.json';
import { alphaEndParticles } from '../src/render/masteryi-q-end-particles';
import { ALPHA_END_HISTORY_TICKS } from '../src/content/masteryi-q-end-timing';

test('complete cast closure preserves two finite emitters and 41 authored mips', () => {
  expect(data.profiles.map((p) => p.name)).toEqual(['disappear', 'Distort']);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(41);
  expect(alphaEndParticles(341, 0)).toEqual([]);
  expect(alphaEndParticles(341, 1 / 60).map((p) => p.profileIndex)).toEqual([0, 1]);
  expect(
    alphaEndParticles(341, 6 / 60)
      .filter((p) => p.profileIndex === 0)
      .map((p) => p.bornTick)
  ).toEqual([1, 4, 6]);
  expect(alphaEndParticles(341, ALPHA_END_HISTORY_TICKS / 60)).toEqual([]);
  expect(data.profiles.every((p) => p.linger > 10 || p.linger === 10)).toBe(true);
});

test('random atlas start advances once per source frame clock and seeks exactly', () => {
  const source = JSON.stringify(data);
  const sample = (tick: number) =>
    alphaEndParticles(341, tick / 60).find((p) => p.profileIndex === 0 && p.ordinal === 1)!;
  const first = sample(1),
    later = sample(8);
  const index = (p: typeof first) => p.uv.cell[0] * 2 + p.uv.cell[1] * 4;
  expect(index(later)).toBe((index(first) + 1) % 4);
  expect(first.uv.cellSize).toEqual([0.5, 0.5]);
  expect(later.offset[1]).toBeCloseTo(10 + (250 * 7) / 60, 10);
  const before = alphaEndParticles(341, 8 / 60);
  for (const tick of [12, 1, 14, 3, 8]) alphaEndParticles(341, tick / 60);
  expect(alphaEndParticles(341, 8 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  expect(alphaEndParticles(342, 8 / 60)).not.toEqual(before);
});

test('distortion keeps its authored growth, upward velocity and omitted bind default', () => {
  const particle = alphaEndParticles(341, 7 / 60).find((p) => p.profileIndex === 1)!;
  expect(new Set(particle.size).size).toBe(1);
  expect(particle.size[0]).toBeCloseTo((320 * 3 * 0.1) / 0.25, 10);
  expect(particle.offset[1]).toBeCloseTo(5, 10);
  expect(particle.bind).toBe(0);
  expect(particle.uv.cell).toEqual([0, 0]);
  expect(data.profiles[1].distortion).toMatchObject({ mode: 2, strength: 0.09000000357627869 });
});

test.each([NaN, Infinity, -Infinity, -1])('invalid time %s has no particles', (time) => {
  expect(alphaEndParticles(341, time)).toEqual([]);
});
