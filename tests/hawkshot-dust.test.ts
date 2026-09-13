import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dustParticles } from '../src/render/hawkshot-dust-state';
import { HAWKSHOT_DUST as D } from '../src/content/hawkshot-dust';
const flight = {
  id: 42,
  origin: { x: 100, y: 200 },
  direction: { x: 1, y: 0 },
  speed: 1400,
  launchTick: 61,
};

test('dust reconstructs stable random cells, motion and lifetimes independently of render history', () => {
  expect(dustParticles(flight, 0.9)).toEqual([]);
  const first = dustParticles(flight, 1.25);
  dustParticles(flight, 10);
  expect(dustParticles(JSON.parse(JSON.stringify(flight)), 1.25)).toEqual(first);
  expect(first.length).toBe(16);
  expect(new Set(first.map((p) => p.frame)).size).toBe(4);
  const later = dustParticles(flight, 1.3);
  for (const p of first) {
    expect(p.life).toBeGreaterThanOrEqual(0.5);
    expect(p.life).toBeLessThanOrEqual(1);
    const next = later.find((n) => n.index === p.index)!;
    expect(next.frame).toBe(p.frame);
    expect(next.rotation).toBe(p.rotation);
    expect(next.alpha).toBeLessThan(p.alpha);
    expect(next.size).toBeGreaterThan(p.size);
    expect([next.x, next.y, next.lift]).not.toEqual([p.x, p.y, p.lift]);
  }
  expect(dustParticles(flight, 100).length).toBeLessThanOrEqual(61);
});

test('dust motion rotates with flight direction and existing particles expire after arrival', () => {
  const a = dustParticles({ ...flight, origin: { x: 0, y: 0 } }, 1.7);
  const b = dustParticles({ ...flight, origin: { x: 0, y: 0 }, direction: { x: 0, y: 1 } }, 1.7);
  a.forEach((p, i) => {
    expect(b[i].x).toBeCloseTo(-p.y);
    expect(b[i].y).toBeCloseTo(p.x);
    expect(b[i].lift).toBe(p.lift);
  });
  const arrival = { ...flight, arrivalTick: 90, distance: 700 };
  const tail = dustParticles(arrival, 1.7);
  expect(tail.length).toBeGreaterThan(0);
  expect(tail.every((p) => p.index < 30)).toBe(true);
  expect(dustParticles(arrival, 2.51)).toEqual([]);
  expect(D.rate).toBe(60);
});

test('dust runtime parameters retain the authored motion and random ranges', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-sprites.json', 'utf8'));
  const e = pin.emitters.find((e: any) => e.emitterName === 'Dust');
  expect(D.rate).toBe(e.rate.constantValue);
  expect(D.lifetime).toBe(e.particleLifetime.constantValue);
  expect(D.lifeRange).toEqual(e.particleLifetime.dynamics.probabilityTables[0].keyValues);
  expect(D.box).toEqual(e.SpawnShape.Size);
  expect(D.velocity).toEqual(e.birthVelocity.constantValue);
  expect(D.drag).toEqual(e.birthDrag.constantValue);
  expect(D.orbitalRanges).toEqual(
    e.birthOrbitalVelocity.dynamics.probabilityTables.map((p: any) => p.keyValues)
  );
  expect(D.color).toEqual(e.Color.constantValue);
});
