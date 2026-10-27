import { expect, test } from 'vitest';
import data from '../src/content/masteryi-q-cast-particles.json';
import { alphaCastParticles } from '../src/render/masteryi-q-cast-particles';
import { ALPHA_CAST_HISTORY_TICKS } from '../src/content/masteryi-q-cast-timing';

test('complete cast closure preserves two finite emitters and 35 authored mips', () => {
  expect(data.profiles.map((p) => p.name)).toEqual(['disappear', 'bubble1']);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(35);
  expect(alphaCastParticles(341, 0)).toEqual([]);
  expect(alphaCastParticles(341, 1 / 60).map((p) => p.profileIndex)).toEqual([0, 1, 1, 1, 1]);
  expect(
    alphaCastParticles(341, 5 / 60)
      .filter((p) => p.profileIndex === 0)
      .map((p) => p.bornTick)
  ).toEqual([1, 5]);
  expect(alphaCastParticles(341, ALPHA_CAST_HISTORY_TICKS / 60)).toEqual([]);
  expect(data.profiles.every((p) => p.linger > 10 || p.linger === 10)).toBe(true);
});

test('random atlas start advances once per source frame clock and seeks exactly', () => {
  const source = JSON.stringify(data);
  const sample = (tick: number) =>
    alphaCastParticles(341, tick / 60).find((p) => p.profileIndex === 0 && p.ordinal === 1)!;
  const first = sample(1),
    later = sample(8);
  const index = (p: typeof first) => p.uv.cell[0] * 2 + p.uv.cell[1] * 4;
  expect(index(later)).toBe((index(first) + 1) % 4);
  expect(first.uv.cellSize).toEqual([0.5, 0.5]);
  expect(later.offset[1]).toBeCloseTo(10 + (150 * 7) / 60, 10);
  const before = alphaCastParticles(341, 8 / 60);
  for (const tick of [12, 1, 14, 3, 8]) alphaCastParticles(341, tick / 60);
  expect(alphaCastParticles(341, 8 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  expect(alphaCastParticles(342, 8 / 60)).not.toEqual(before);
});

test('bubble keeps authored uniform growth, four independent births and spin', () => {
  const particles = alphaCastParticles(341, 7 / 60).filter((p) => p.profileIndex === 1);
  expect(particles).toHaveLength(4);
  for (const p of particles) {
    expect(new Set(p.size).size).toBe(1);
    expect(p.rotation[0]).toBeCloseTo(12, 10);
    expect(p.offset).toEqual([0, 140, 0]);
    expect(p.uv.cell).toEqual([0, 0]);
    expect(p.bind).toBe(1);
  }
});

test.each([NaN, Infinity, -Infinity, -1])('invalid time %s has no particles', (time) => {
  expect(alphaCastParticles(341, time)).toEqual([]);
});
