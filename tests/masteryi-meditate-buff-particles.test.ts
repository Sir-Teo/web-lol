import { expect, test } from 'vitest';
import data from '../src/content/masteryi-w-buff-particles.json';
import { meditateBuffParticles } from '../src/render/masteryi-w-buff-particles';
const sample = (time: number, name: string, ordinal = 1) =>
  meditateBuffParticles(341, time).find(
    (p) => data.profiles[p.profileIndex].name === name && p.ordinal === ordinal
  )!;

test('all four source families start together with six complete mip transports', () => {
  expect(data.profiles.map((p) => p.name)).toEqual(['bigray', 'orb', 'nova', 'energy_sparks']);
  expect(meditateBuffParticles(341, 0)).toEqual([]);
  expect(new Set(meditateBuffParticles(341, 1 / 60).map((p) => p.profileIndex)).size).toBe(4);
  expect(data.textures.reduce((sum, t) => sum + t.rectangles.length, 0)).toBe(54);
});
test('authored ray start frame and eight independently selected orb frames are retained', () => {
  const ray = sample(1 / 60, 'bigray');
  expect(ray.uv.cell).toEqual([0.5, 0.5]);
  expect(ray.uv.cellSize).toEqual([0.5, 0.5]);
  const orbs = meditateBuffParticles(341, 1.9).filter((p) => p.profileIndex === 1);
  expect(new Set(orbs.map((p) => p.uv.cell[1])).size).toBe(8);
  expect(orbs.every((p) => p.uv.cell[0] === 0 && p.uv.cellSize[1] === 1 / 8)).toBe(true);
});
test('orb rotation is a draw-time radian orbit, with independently scrolling multiplier UV', () => {
  const orb = sample(7 / 60, 'orb');
  expect(orb.age).toBeCloseTo(0.1, 12);
  expect(orb.offset).toEqual([0, 98.5, 0]);
  expect(orb.orbitTurn[1]).toBeCloseTo(Math.sin(-0.05), 12);
  expect(orb.orbitTurn[3]).toBeCloseTo(Math.cos(-0.05), 12);
  expect(orb.uv.offset).not.toEqual(orb.multUv!.offset);
});
test('spark shape rotation retains radius while attraction bends the finite trajectory', () => {
  const initial = sample(1 / 60, 'energy_sparks'),
    later = sample(13 / 60, 'energy_sparks');
  expect(Math.hypot(initial.offset[0], initial.offset[2])).toBeGreaterThanOrEqual(88);
  expect(Math.hypot(initial.offset[0], initial.offset[2])).toBeLessThanOrEqual(110);
  expect(initial.offset[1]).toBe(150);
  expect(later.travel).not.toEqual(initial.travel);
  expect(data.profiles[3].lookupScales).toEqual([0.5, 1]);
  expect(later.size[0]).toBe(later.size[1]);
});
test('interruption stops births on the stopped update and preserves only existing finite tails', () => {
  expect(meditateBuffParticles(341, 0.2, 0)).toEqual([]);
  const atStop = meditateBuffParticles(341, 1, 0.2);
  expect(atStop.length).toBeGreaterThan(0);
  expect(atStop.every((p) => p.bornTick < 12)).toBe(true);
  expect(meditateBuffParticles(341, 2.2, 0.2)).toEqual([]);
  expect(meditateBuffParticles(341, 361 / 60)).toEqual([]);
});
test('random seeks are exact and source tables remain immutable', () => {
  const source = JSON.stringify(data),
    before = meditateBuffParticles(341, 2.25);
  for (const time of [5.9, 0, 0.15, 4.1, 2]) meditateBuffParticles(341, time);
  expect(meditateBuffParticles(341, 2.25)).toEqual(before);
  expect(meditateBuffParticles(342, 2.25)).not.toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
});
test.each([NaN, Infinity, -Infinity, -1])('invalid time %s has no particles', (time) =>
  expect(meditateBuffParticles(341, time)).toEqual([])
);
