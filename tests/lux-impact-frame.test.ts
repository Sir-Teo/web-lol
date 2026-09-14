import { expect, it } from 'vitest';
import type { LuxImpactVisual } from '../src/simulation/types';
import { luxImpactFrame, luxImpactSparkAnchor } from '../src/render/lux-impact-frame';
it('accumulates binding along the saved path instead of scaling total displacement by current weight', () => {
  const effect: LuxImpactVisual = {
    id: 10,
    sourceId: 1,
    targetId: 2,
    team: 'blue',
    critical: false,
    startTick: 100,
    detachedTick: null,
    targetRig: null,
    frames: Array.from({ length: 32 }, (_, i) => ({
      tick: 100 + i,
      facing: 0,
      animationTimeline: null,
      x: i * 10,
      y: i < 15 ? 0 : (i - 15) * 20,
    })),
  };
  expect(luxImpactFrame(effect, 100.5)).toEqual({ x: 5, y: 0 });
  expect(luxImpactFrame(effect, 0)).toEqual({ x: 0, y: 0 });
  expect(luxImpactFrame(effect, 200)).toEqual({ x: 310, y: 320 });
  const birth = luxImpactFrame(effect, 101);
  const p = luxImpactSparkAnchor(effect, 130);
  expect(p.x).toBeGreaterThan(birth.x);
  expect(p.y).toBeGreaterThan(0);
  // After 0.5 s the binding reaches zero, but previously inherited motion remains.
  expect(luxImpactSparkAnchor(effect, 131)).toEqual(p);
  const a = luxImpactSparkAnchor(effect, 110),
    b = luxImpactSparkAnchor(effect, 111);
  expect(luxImpactSparkAnchor(effect, 110.5)).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const same = luxImpactSparkAnchor(effect, 120);
  luxImpactSparkAnchor(effect, 131);
  expect(luxImpactSparkAnchor(effect, 120)).toEqual(same);
});
