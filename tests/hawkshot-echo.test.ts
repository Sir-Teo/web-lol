import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { echoParticles } from '../src/render/hawkshot-echo-state';
import { HAWKSHOT_ECHO as E } from '../src/content/hawkshot-echo';

const flight = {
  id: 12,
  origin: { x: 100, y: 200 },
  direction: { x: 1, y: 0 },
  speed: 1400,
  launchTick: 61,
};

test('bound Owl3 particles follow the scout and descend/fade independently without render history', () => {
  expect(echoParticles(flight, 0.9)).toEqual([]);
  const particles = echoParticles(flight, 1.25);
  expect(particles.map((p) => p.index)).toEqual([0, 1, 2]);
  for (const p of particles) {
    expect(p.x).toBe(450);
    expect(p.y).toBe(200);
    expect(p.lift).toBeCloseTo(-3 * p.age);
    expect(p.alpha).toBeCloseTo(E.alpha * (1 - p.age / E.lifetime));
  }
  const saved = JSON.parse(JSON.stringify(flight));
  echoParticles(flight, 15);
  expect(echoParticles(saved, 1.25)).toEqual(particles);
  expect(echoParticles(flight, 10).length).toBeLessThanOrEqual(4);
});

test('arrival stops Owl3 births, freezes its bound origin and lets existing particles expire', () => {
  const arrival = { ...flight, arrivalTick: 90, distance: 700 };
  const particles = echoParticles(arrival, 1.6);
  expect(particles.length).toBeGreaterThan(0);
  expect(particles.every((p) => p.index < 5 && p.x === 800)).toBe(true);
  expect(echoParticles(arrival, 1.81)).toEqual([]);
});

test('Owl3 profile is pinned to the same reusable assets as Owl2', () => {
  const raw = readFileSync('docs/reference/hawkshot-effects.json');
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-echo.json', 'utf8'));
  expect(createHash('sha256').update(raw).digest('hex')).toBe(pin.definitionsSha256);
  const emitters = JSON.parse(raw.toString()).records[pin.record].data.complexEmitterDefinitionData;
  const source = emitters.find((e: any) => e.emitterName === 'Owl3');
  expect(pin.emitter).toEqual(source);
  const rim = emitters.find((e: any) => e.emitterName === 'Owl2');
  for (const field of ['primitive', 'texture', 'birthScale0', 'birthRotation0', 'birthColor'])
    expect(source[field]).toEqual(rim[field]);
  expect(E.rate).toBe(source.rate.constantValue);
  expect(E.lifetime).toBe(source.particleLifetime.constantValue);
  expect(E.velocity).toEqual(source.birthVelocity.constantValue);
  expect(E.alpha).toBe(source.Color.dynamics.values[0][3]);
  expect(E.fresnelColor).toEqual(source.reflectionDefinition.fresnelColor);
});
