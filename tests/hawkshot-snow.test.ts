import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { HAWKSHOT_SNOW as S } from '../src/content/hawkshot-snow';
import { snowParticles } from '../src/render/hawkshot-snow-state';
import type { ScoutVisual } from '../src/simulation/types';
const effect: ScoutVisual = {
  x: 0,
  y: 0,
  team: 'blue',
  flight: {
    id: 17,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 1400,
    launchTick: 1,
    arrivalTick: 60,
    distance: 700,
  },
  stopTick: 360,
  endTick: 420,
};
test('snow layers retain source differences in scaling, force and orientation', () => {
  const p = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8'));
  S.forEach((s, i) => {
    const e = p.emitters[i + 1];
    expect(s.name).toBe(e.emitterName);
    expect(s.scale).toEqual(e.birthScale0.constantValue);
    expect(s.rate).toBe(e.rate.constantValue);
    expect(s.orbit).toEqual(e.birthOrbitalVelocity.constantValue);
    expect(s.uniform).toBe(!!e.isUniformScale);
    expect(s.directionOriented).toBe(!!e.isDirectionOriented);
  });
  expect(S[0].drag[1]).toBe(2);
  expect(S[0].acceleration[1]).toBe(-100);
  expect(S[1].drag[1]).toBe(0);
  expect(S[1].acceleration[1]).toBe(0);
});
test('both snow tails restore, remain distinct and expire without additional births', () => {
  for (let layer = 0; layer < 2; layer++) {
    expect(snowParticles(effect, 1, layer)).toEqual([]);
    const p = snowParticles(effect, 6.05, layer);
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((p) => p.birth <= S[layer].rate * 5)).toBe(true);
    expect(p.every((p) => p.frame >= 0 && p.frame < 4 && p.alpha >= 0 && p.alpha <= 1)).toBe(true);
    if (layer === 1) expect(p.every((p) => p.width === p.heightSize)).toBe(true);
    else expect(p.some((p) => p.width !== p.heightSize)).toBe(true);
    expect(snowParticles(JSON.parse(JSON.stringify(effect)), 6.05, layer)).toEqual(p);
    expect(snowParticles(effect, 7, layer)).toEqual([]);
  }
});
