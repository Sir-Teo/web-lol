import { expect, test } from 'vitest';
import data from '../src/content/masteryi-r-cast-particles.json';
import { highlanderCastParticles } from '../src/render/masteryi-r-cast-particles';
import { HIGHLANDER_CAST_HISTORY_TICKS } from '../src/content/masteryi-r-cast-timing';
test('all eight source families retain the complete texture and mesh closure', () => {
  expect(data.profiles.map((p) => p.name)).toEqual([
    'speed',
    'fireball',
    'ring',
    'ground_glow',
    'lensflare',
    'speed2',
    'Distort',
    'flash',
  ]);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(86);
  expect(data.meshes.map((m) => m.exportedCorners)).toEqual([1440, 900]);
  expect(highlanderCastParticles(341, 0)).toEqual([]);
  const p = highlanderCastParticles(341, 9 / 60);
  expect(p).toHaveLength(23);
  expect(new Set(p.map((p) => p.profileIndex)).size).toBe(8);
});
test('delayed speed follows the existing Solar first-update grid while lens lifetime stays omitted', () => {
  expect(highlanderCastParticles(341, 5 / 60).some((p) => p.profileIndex === 5)).toBe(false);
  const speed = highlanderCastParticles(341, 6 / 60).find((p) => p.profileIndex === 5)!;
  expect(speed.age).toBe(0);
  expect(speed.bornTick).toBe(6);
  expect(data.profiles[4].emitterLife).toBeNull();
  expect(highlanderCastParticles(341, 1 / 60).filter((p) => p.profileIndex === 4)).toHaveLength(14);
});
test('random seeks preserve exact curves and finite life without source linger extension', () => {
  const source = JSON.stringify(data),
    before = highlanderCastParticles(341, 9 / 60);
  for (const t of [26, 1, 6, 19, 9]) highlanderCastParticles(341, t / 60);
  expect(highlanderCastParticles(341, 9 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  // The retained cast has no varying probability tables or random atlas starts.
  const probabilityTables: any[] = [];
  const collect = (value: any) => {
    if (value && typeof value === 'object') {
      if (Array.isArray(value.probabilities)) probabilityTables.push(...value.probabilities);
      for (const child of Object.values(value)) collect(child);
    }
  };
  collect(data.profiles);
  expect(probabilityTables.every((table) => table.values.length === 0 && table.single === 1)).toBe(
    true
  );
  expect(data.profiles.every((profile) => !profile.uv.randomStart)).toBe(true);
  expect(highlanderCastParticles(342, 9 / 60)).toEqual(before);
  expect(highlanderCastParticles(341, HIGHLANDER_CAST_HISTORY_TICKS / 60)).toEqual([]);
  expect(highlanderCastParticles(341, 1000)).toEqual([]);
});
test('distortion preserves explicit mode and strength while mesh local flags stay authored', () => {
  expect(data.profiles[6].distortion).toMatchObject({ mode: 2, strength: 1 });
  expect(data.profiles.filter((p) => p.kind === 'mesh').every((p) => p.particleLocal)).toBe(true);
  expect(data.profiles.some((p) => p.lookup === null)).toBe(true);
  expect(data.profiles.some((p) => (p.linger ?? 0) > 10)).toBe(true);
});
test.each([NaN, Infinity, -Infinity, -1])('invalid time %s emits nothing', (time) =>
  expect(highlanderCastParticles(341, time)).toEqual([])
);
