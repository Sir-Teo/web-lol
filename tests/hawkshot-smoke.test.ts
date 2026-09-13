import { expect, test } from 'vitest';
import { smokeParticles } from '../src/render/hawkshot-smoke-state';
import { HAWKSHOT_SMOKE as S } from '../src/content/hawkshot-smoke';
import { readFileSync } from 'node:fs';
const flight = {
  id: 23,
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  speed: 1400,
  launchTick: 61,
};
test('smoke stays at birth positions with stable cells and fades/erodes across its own lifetime', () => {
  const particles = smokeParticles(flight, 1.25);
  expect(particles.length).toBeGreaterThan(5);
  const next = smokeParticles(flight, 1.27);
  for (const p of particles) {
    const n = next.find((n) => n.index === p.index)!;
    expect(n.x).toBe(p.x);
    expect(n.y).toBe(p.y);
    expect(n.frame).toBe(p.frame);
    expect(n.erosion).toBeGreaterThan(p.erosion);
    expect(n.height).toBeGreaterThan(p.height);
    expect(p.life).toBeGreaterThanOrEqual(0.3);
    expect(p.life).toBeLessThanOrEqual(S.lifetime);
  }
  expect(smokeParticles(JSON.parse(JSON.stringify(flight)), 1.25)).toEqual(particles);
  const arrival = { ...flight, arrivalTick: 90, distance: 700 };
  expect(smokeParticles(arrival, 1.6).every((p) => p.index < 15)).toBe(true);
  expect(smokeParticles(arrival, 2.11)).toEqual([]);
});
test('smoke softness, red erosion and scale/lifetime values retain source evidence', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-sprites.json', 'utf8'));
  const e = pin.emitters.find((e: any) => e.emitterName === 'Smoke_Trail');
  expect(S.softDistance).toBe(e.softParticleParams.deltaIn * 0.01);
  expect(S.erosionFeatherOut).toBe(e.alphaErosionDefinition.erosionFeatherOut);
  expect(S.birthScale).toEqual(e.birthScale0.constantValue);
  expect(S.colorTimes).toEqual(e.Color.dynamics.times);
  expect(S.alphaValues).toEqual(e.Color.dynamics.values.map((v: number[]) => v[3]));
  expect(S.rate).toBe(e.rate.constantValue);
  expect(S.lifetime).toBe(e.particleLifetime.constantValue);
});
