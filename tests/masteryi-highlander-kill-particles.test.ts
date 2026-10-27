import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import data from '../src/content/masteryi-r-kill-particles.json';
import contacts from '../src/content/masteryi-q-contact-particles.json';
import { highlanderKillParticles } from '../src/render/masteryi-r-kill-particles';
import { HIGHLANDER_KILL_HISTORY_TICKS } from '../src/content/masteryi-r-kill-timing';
test('all three source families retain 42 mips and reuse the exact Q contact mesh', () => {
  expect(data.profiles.map((p) => p.kind)).toEqual(['billboard', 'mesh', 'billboard']);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(42);
  expect(data.mesh).toEqual(contacts.mesh);
  const glb = readFileSync('public/' + data.mesh.url);
  const doc = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  expect(doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION].count).toBe(4500);
  expect(data.profiles.map((p) => p.renderOrder)).toEqual([-13, 100, 0]);
});
test('first-update births retain the delayed second bubble and finite 88-tick bound', () => {
  expect(highlanderKillParticles(12, 0)).toEqual([]);
  const bubble = (t: number) =>
    highlanderKillParticles(12, t / 60).filter((p) => p.profileIndex === 2);
  expect(bubble(29).map((p) => p.bornTick)).toEqual([1]);
  expect(bubble(30).map((p) => p.bornTick)).toEqual([1, 30]);
  const swirls = new Set<number>();
  for (let t = 0; t < 88; t++)
    for (const p of highlanderKillParticles(12, t / 60))
      if (p.profileIndex === 1) swirls.add(p.ordinal);
  expect(swirls.size).toBe(17);
  expect(bubble(86).map((p) => p.bornTick)).toEqual([30]);
  expect(highlanderKillParticles(12, HIGHLANDER_KILL_HISTORY_TICKS / 60)).toEqual([]);
});
test('source swirl spin, UV travel, probability and uniform bubble growth survive random seeks', () => {
  const source = JSON.stringify(data),
    before = highlanderKillParticles(12, 20 / 60);
  for (const t of [70, 1, 30, 4, 87]) highlanderKillParticles(12, t / 60);
  expect(highlanderKillParticles(12, 20 / 60)).toEqual(before);
  expect(JSON.stringify(data)).toBe(source);
  expect(highlanderKillParticles(13, 20 / 60)).not.toEqual(before);
  const bubble = before.find((p) => p.profileIndex === 2)!;
  expect(new Set(bubble.size).size).toBe(1);
  expect(bubble.size[0]).toBeGreaterThan(45);
  expect(data.profiles[0].lookup).toBeNull();
  expect(data.profiles[0].blend).toBe(4);
  expect(data.profiles[1].noCull).toBe(true);
  expect(data.profiles[1].spin.values[0][0]).toBe(100);
  const swirl = before.find((p) => p.profileIndex === 1 && p.ordinal === 2)!;
  expect(swirl.uv.offset[0]).toBeCloseTo((3 * swirl.age) % 1, 12);
  const later = highlanderKillParticles(12, 21 / 60).find(
    (p) => p.profileIndex === 1 && p.ordinal === 2
  )!;
  expect(later.rotation[0] - swirl.rotation[0]).toBeCloseTo(100 / 60, 12);
});
test.each([NaN, Infinity, -Infinity, -1])('invalid time %s emits nothing', (t) =>
  expect(highlanderKillParticles(12, t)).toEqual([])
);
