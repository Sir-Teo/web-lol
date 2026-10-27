import { expect, test } from 'vitest';
import data from '../src/content/masteryi-sword-particles.json';
import { swordGlowParticles } from '../src/render/masteryi-sword-particles';
test('all fourteen profiles and authored condition instances remain complete', () => {
  expect(data.profiles).toHaveLength(14);
  expect(data.bindings).toHaveLength(5);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(78);
  expect(data.profiles.every((p) => p.particleLocal && p.bind.values[0][0] === 1)).toBe(true);
  expect(data.bindings.map((b) => b.glbNode)).toEqual([87, 88, 89, 90, 87]);
});
test('initial update preserves source bursts, finite beams and source-only system filtering', () => {
  expect(swordGlowParticles(14, 0)).toEqual([]);
  const first = swordGlowParticles(14, 1 / 60, Infinity, 'MasterYi_E_SuperChraged_buf');
  expect(first.map((p) => p.profileIndex)).toEqual([9, 10, 11, 11, 12]);
  expect(first.every((p) => p.bornTick === 1 && p.age === 0)).toBe(true);
  expect(
    swordGlowParticles(14, 2, Infinity, 'MasterYi_E_SuperChraged_buf').every((p) =>
      [9, 10].includes(p.profileIndex)
    )
  ).toBe(true);
});
test('stop excludes removal-tick births and retains only finite existing particles', () => {
  const stopped = swordGlowParticles(14, 1, 0.5, 'MasterYi_E_SuperChraged_Sword1_buf');
  expect(stopped.length).toBeGreaterThan(0);
  expect(stopped.every((p) => p.bornTick < 30)).toBe(true);
  expect(swordGlowParticles(14, 1.5, 0.5)).toEqual([]);
  expect(swordGlowParticles(14, 0.1, 0)).toEqual([]);
});
test('large seeks keep a bounded live window and stable ordinal identities', () => {
  const before = swordGlowParticles(14, 1e6, Infinity, 'MasterYi_E_SuperChraged_Sword1_buf');
  expect(before.length).toBeGreaterThan(0);
  expect(before.length).toBeLessThanOrEqual(64);
  expect(before.every((p) => p.age >= 0 && p.age < 1 && p.ordinal > 1e6)).toBe(true);
  swordGlowParticles(14, 3);
  expect(swordGlowParticles(14, 1e6, Infinity, 'MasterYi_E_SuperChraged_Sword1_buf')).toEqual(
    before
  );
});
test('authored multiplier scroll, negative size probability and atlas omissions remain distinct', () => {
  const all = Array.from({ length: 20 }, (_, seed) => swordGlowParticles(seed, 5 / 60)).flat();
  expect(all.some((p) => p.multUv !== null)).toBe(true);
  expect(all.some((p) => p.size[1] < 0)).toBe(true);
  const flares = data.profiles.filter((p) => p.name === 'Activate_Flare'),
    beams = data.profiles.filter((p) => p.name === 'beam');
  expect(
    flares.every(
      (p) =>
        p.rawUv.numFrames === 4 && p.rawUv.texDiv === null && p.uv.divisions.join(',') === '1,1'
    )
  ).toBe(true);
  expect(beams.every((p) => p.uv.divisions.join(',') === '2,2' && p.uv.frames === 4)).toBe(true);
});
test.each([NaN, Infinity, -Infinity, -1])('invalid source time %s emits nothing', (t) =>
  expect(swordGlowParticles(14, t)).toEqual([])
);

test('an integer removal tick remains exclusive after conversion through seconds', () => {
  const stopTick = 116,
    particles = swordGlowParticles(14, stopTick / 60, stopTick / 60, 'MasterYi_E_buff');
  expect(particles.length).toBeGreaterThan(0);
  expect(particles.every((p) => p.bornTick < stopTick)).toBe(true);
});
