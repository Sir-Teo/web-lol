import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { HAWKSHOT_SPARKLE as S } from '../src/content/hawkshot-sparkle';
import { sparkleParticles } from '../src/render/hawkshot-sparkle-state';
import type { ScoutVisual } from '../src/simulation/types';

const effect: ScoutVisual = {
  x: 1000,
  y: 2000,
  team: 'blue',
  flight: {
    id: 17,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 1400,
    launchTick: 1,
    arrivalTick: 60,
    distance: 1000,
  },
  stopTick: 360,
  endTick: 420,
};

test('Sparkle profile preserves uniform X size and zero-peak-zero authored growth', () => {
  const e = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8')).emitters.find(
    (e: any) => e.emitterName === 'Sparkle'
  );
  expect(S.rate).toBe(e.rate.constantValue);
  expect(S.scale).toBe(e.birthScale0.constantValue[0]);
  expect(S.scale).toBe(20);
  expect(S.growth).toEqual(e.scale0.dynamics.values.map((v: number[]) => v[0]));
  expect(S.growth).toEqual([0, 1, 0]);
  expect(S.color).toEqual(e.Color.constantValue);
  expect(S.lifeRange).toEqual(e.particleLifetime.dynamics.probabilityTables[0].keyValues);
  expect(S.shape).toEqual(e.SpawnShape.emitOffset.constantValue);
  expect(e.texDiv).toBeUndefined();
});

test('Sparkle grows then shrinks, keeps a late visual tail and never emits after stop', () => {
  expect(sparkleParticles(effect, 1.19)).toEqual([]);
  const born = sparkleParticles(effect, 1.2)[0];
  expect(born.size).toBe(0);
  const mid = sparkleParticles(effect, 1.2 + born.life * 0.5).find((p) => p.birth === 1)!;
  const late = sparkleParticles(effect, 1.2 + born.life * 0.8).find((p) => p.birth === 1)!;
  expect(mid.size).toBeGreaterThan(late.size);
  expect(mid.height).toBeLessThan(born.height);
  const tail = sparkleParticles(effect, 6.05);
  expect(tail.some((p) => p.birth === 25)).toBe(true);
  expect(tail.every((p) => p.birth <= 25)).toBe(true);
  expect(sparkleParticles(JSON.parse(JSON.stringify(effect)), 6.05)).toEqual(tail);
  expect(sparkleParticles(effect, 6.41)).toEqual([]);
});
