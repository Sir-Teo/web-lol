import { expect, test } from 'vitest';
import data from '../src/content/masteryi-w-damage-particles.json';
import contacts from '../src/content/masteryi-q-contact-particles.json';
import { meditateDamageParticles } from '../src/render/masteryi-w-damage-particles';
import { MEDITATE_DAMAGE_HISTORY_TICKS } from '../src/content/masteryi-w-damage-timing';
test('both source emitters share all four Q contact transports and all 32 mips', () => {
  expect(data.profiles.map((p) => p.name)).toEqual(['Hit', 'flash']);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(32);
  for (const t of data.textures)
    expect(contacts.textures.find((x) => x.url === t.url)).toMatchObject({
      sha256: t.sha256,
      bytes: t.bytes,
      rectangles: t.rectangles,
    });
  expect(data.profiles.map((p) => p.miscRenderFlags)).toEqual([1, 0]);
  expect(data.profiles.map((p) => p.renderOrder)).toEqual([30, 0]);
});
test('first local update births both finite families without extending source linger', () => {
  expect(meditateDamageParticles(12, 0)).toEqual([]);
  const first = meditateDamageParticles(12, 1 / 60);
  expect(first.map((p) => [p.profileIndex, p.bornTick, p.age, p.bind])).toEqual([
    [0, 1, 0, 1],
    [1, 1, 0, 0],
  ]);
  expect(meditateDamageParticles(12, 8 / 60).map((p) => p.profileIndex)).toEqual([0, 1]);
  expect(meditateDamageParticles(12, 9 / 60).map((p) => p.profileIndex)).toEqual([0]);
  expect(meditateDamageParticles(12, MEDITATE_DAMAGE_HISTORY_TICKS / 60)).toEqual([]);
  expect(data.profiles[1].linger).toBe(10);
});
test('source rotation probability, shrinking Hit and uniform flash seek exactly', () => {
  const source = JSON.stringify(data),
    before = meditateDamageParticles(12, 5 / 60);
  for (const t of [14, 1, 9, 3]) meditateDamageParticles(12, t / 60);
  expect(meditateDamageParticles(12, 5 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  const other = meditateDamageParticles(13, 5 / 60);
  expect(other[0].rotation).not.toEqual(before[0].rotation);
  expect(other[1]).toEqual(before[1]);
  expect(new Set(before[1].size).size).toBe(1);
  const late = meditateDamageParticles(12, 12 / 60)[0];
  expect(late.size[1]).toBeLessThan(before[0].size[1]);
  expect(before.map((p) => p.offset)).toEqual([
    [0, 100, 0],
    [0, 100, 0],
  ]);
});
test.each([NaN, Infinity, -Infinity, -1])('invalid time %s emits nothing', (t) =>
  expect(meditateDamageParticles(12, t)).toEqual([])
);
