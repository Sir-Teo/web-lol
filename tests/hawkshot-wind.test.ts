import { expect, test } from 'vitest';
import { windParticles } from '../src/render/hawkshot-wind-state';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { ScoutFlight } from '../src/simulation/types';

const flight: ScoutFlight = {
  id: 17,
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  speed: 1400,
  launchTick: 1,
};
test('wind uses deterministic bounded source births without depending on prior renders', () => {
  expect(windParticles(flight, 0.04)).toEqual([]);
  const before = windParticles(flight, 1);
  expect(before.length).toBeGreaterThan(0);
  expect(before.length).toBeLessThanOrEqual(10);
  for (const p of before) {
    expect(p.life).toBeGreaterThanOrEqual(0.3);
    expect(p.life).toBeLessThanOrEqual(0.600001);
    expect(p.alpha).toBeGreaterThanOrEqual(0);
    expect(p.alpha).toBeLessThanOrEqual(0.200001);
    expect(p.scale[0]).toBeGreaterThanOrEqual(0.2);
    expect(p.scale[0]).toBeLessThanOrEqual(0.600001);
    expect(p.scale[1]).toBeGreaterThanOrEqual(0.5);
    expect(p.scale[1]).toBeLessThanOrEqual(1);
    expect(p.erosion).toBeGreaterThanOrEqual(0);
    expect(p.erosion).toBeLessThanOrEqual(0.300001);
    expect(p.x).toBeLessThan(1400);
    expect(p.lift).toBeGreaterThanOrEqual(0);
    expect(p.lift).toBeLessThan(0.2);
  }
  windParticles(flight, 100);
  expect(windParticles(flight, 1)).toEqual(before);
  expect(windParticles({ ...flight, id: 18 }, 1)).not.toEqual(before);
});

test('arrival stops wind births and saved trajectory preserves the remaining particles', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.units = [w.hero];
  w.hero.x = w.hero.y = 0;
  w.nextWaveTick = Infinity;
  w.pendingSpawns = [];
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 1400, y: 0 } });
  w.step(60);
  expect(w.projectiles).toHaveLength(0);
  const trajectory = w.visionAreas.find((a) => a.kind === 'scout')!.flight!;
  expect(trajectory).toMatchObject({ ...flight, id: trajectory.id, arrivalTick: 60 });
  expect(trajectory.distance).toBeCloseTo(1400);
  const particles = windParticles(trajectory, w.time);
  expect(particles.length).toBeGreaterThan(0);
  expect(
    windParticles(trajectory, 1.1).every((p) => particles.some((old) => old.index === p.index))
  ).toBe(true);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(windParticles(restored.visionAreas[0].flight!, restored.time)).toEqual(particles);
  expect(windParticles(trajectory, 1.61)).toEqual([]);
  const malformed = JSON.parse(w.snapshot());
  malformed.visionAreas[0].flight.origin.x = null;
  expect(() => World.fromSnapshot(JSON.stringify(malformed), w.battlefield)).toThrow();
});
