import { expect, test } from 'vitest';
import data from '../src/content/masteryi-w-cast-particles.json';
import { meditateCastParticles } from '../src/render/masteryi-w-cast-particles';
import { MEDITATE_CAST_HISTORY_TICKS } from '../src/content/masteryi-w-cast-timing';

const named = (time: number, name: string, ordinal = 1) => {
  const p = meditateCastParticles(341, time).find(
    (p) => data.profiles[p.profileIndex].name === name && p.ordinal === ordinal
  );
  expect(p).toBeDefined();
  return p!;
};

test('all seven complete cast emitters participate on the source first-update grid', () => {
  expect(data.profiles.map((p) => p.name)).toEqual([
    'fireline',
    'spiral_1',
    'spiral_2',
    'spirit_fire',
    'Flash',
    'energy_wave',
    'Stars_Green',
  ]);
  expect(meditateCastParticles(341, 0)).toEqual([]);
  const first = meditateCastParticles(341, 1 / 60);
  expect(first).toHaveLength(10);
  expect(new Set(meditateCastParticles(341, 2 / 60).map((p) => p.profileIndex)).size).toBe(7);
  expect(data.textures.reduce((count, t) => count + t.rectangles.length, 0)).toBe(87);
});

test('random seeks are exact and never modify source curves', () => {
  const source = JSON.stringify(data),
    before = meditateCastParticles(341, 8 / 60);
  for (const tick of [34, 1, 52, 3, 54, 8]) meditateCastParticles(341, tick / 60);
  expect(meditateCastParticles(341, 8 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  expect(meditateCastParticles(342, 8 / 60)).not.toEqual(before);
});

test('source velocity and indexed spin preserve the torus rise and independent lifetimes', () => {
  const first = named(7 / 60, 'spiral_1'),
    second = named(7 / 60, 'spiral_2');
  expect(first.age).toBeCloseTo(0.1, 12);
  expect(first.offset).toEqual([0, 129, 0]);
  expect(first.life).toBe(data.profiles[1].life.values[0][0]);
  expect(second.life).toBe(data.profiles[2].life.values[0][0]);
  expect(first.rotation[1]).toBeGreaterThanOrEqual(10);
  expect(first.rotation[1]).toBeLessThanOrEqual(11);
  expect(first.bind).toBe(1);
  expect(second.bind).toBe(1);
});

test('hashed world acceleration remains independent of local velocity and root orientation', () => {
  const star = named(7 / 60, 'Stars_Green');
  expect(star.bornTick).toBe(1);
  expect(star.age).toBeCloseTo(0.1, 12);
  // Six semi-implicit 60 Hz updates: (10+20+30+40+50+60)/60 = 3.5.
  expect(star.worldOffset[1]).toBeCloseTo(3.5, 12);
  expect(star.worldTravel).toEqual([0, 60, 0]);
  expect(star.worldOffset[0]).toBe(0);
  expect(star.worldOffset[2]).toBe(0);
  expect(star.travel[1]).toBeGreaterThanOrEqual(10);
  expect(star.travel[1]).toBeLessThanOrEqual(100);
});

test('base and multiplier UV layers scroll independently without changing source alpha-lock mode', () => {
  const fire = named(8 / 60, 'spirit_fire');
  expect(data.profiles[fire.profileIndex].uvMode).toBe(2);
  expect(fire.multUv).not.toBeNull();
  expect(fire.uv.offset).not.toEqual(fire.multUv!.offset);
  for (const layer of [fire.uv, fire.multUv!]) {
    expect(layer.scale).toEqual([1, 1]);
    expect(layer.cellSize).toEqual([1, 1]);
    expect(layer.offset.every((n) => Number.isFinite(n) && n >= 0 && n < 1)).toBe(true);
  }
});

test('uniform flash growth and source color fades remain authored, without a ten-second linger extension', () => {
  const flash = named(8 / 60, 'Flash');
  expect(new Set(flash.size).size).toBe(1);
  expect(named(1 / 60, 'fireline').color[3]).toBe(0);
  expect(named(8 / 60, 'fireline').color[3]).toBeGreaterThan(0);
  expect(data.profiles.some((p) => (p.linger ?? 0) > 10)).toBe(true);
  expect(meditateCastParticles(341, MEDITATE_CAST_HISTORY_TICKS / 60)).toEqual([]);
  expect(meditateCastParticles(341, 1000)).toEqual([]);
});

test.each([NaN, Infinity, -Infinity, -1])('invalid time %s has no particles', (time) => {
  expect(meditateCastParticles(341, time)).toEqual([]);
});

test('the sparse orbital field retains the pinned reader world-up default', () => {
  const field = data.profiles.at(-1)!.orbitalField;
  expect(field).toMatchObject({ axis: [0, 1, 0], localSpace: false, directionAuthored: false });
});

test('the orbital field redirects newborn star motion tangentially before any elapsed step', () => {
  const star = named(1 / 60, 'Stars_Green');
  expect(star.age).toBe(0);
  expect(star.travel[0]).toBe(0);
  expect(Math.abs(star.travel[2])).toBeGreaterThan(0);
});
