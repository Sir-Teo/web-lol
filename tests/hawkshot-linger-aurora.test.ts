import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { HAWKSHOT_LINGER_AURORA as A } from '../src/content/hawkshot-linger-aurora';
import { lingerAurora } from '../src/render/hawkshot-linger-aurora-state';
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
test('linger Aurora preserves animated life, multiplier scroll and authored erosion', () => {
  const e = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8')).emitters[0];
  expect(A.life).toBe(e.particleLifetime.dynamics.values[0]);
  expect(A.scroll).toEqual(e.textureMult.birthUvScrollRateMult.constantValue);
  expect(A.scale).toEqual(e.birthScale0.constantValue);
  expect(A.featherOut).toBe(e.alphaErosionDefinition.erosionFeatherOut);
  expect(A.alpha).toEqual(e.Color.dynamics.values.map((v: number[]) => v[3]));
});
test('single Aurora drifts and fades deterministically without restarting during reveal', () => {
  expect(lingerAurora(effect, 0.9)).toBeNull();
  const birth = lingerAurora(effect, 1)!;
  expect(birth.alpha).toBe(0);
  expect(Math.hypot(birth.x, birth.y)).toBeLessThanOrEqual(200);
  const mid = lingerAurora(effect, 1 + birth.life * 0.5)!;
  expect(mid.alpha).toBeCloseTo(A.alpha[1]);
  expect(mid.x - birth.x).toBeCloseTo(100 * birth.life * 0.5);
  expect(lingerAurora(JSON.parse(JSON.stringify(effect)), 1 + birth.life * 0.5)).toEqual(mid);
  expect(lingerAurora(effect, 4.01)).toBeNull();
});
