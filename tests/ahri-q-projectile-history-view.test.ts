import { expect, test } from 'vitest';
import type { AhriQProjectileVisual } from '../src/simulation/ahri-q-projectile-visuals';
import {
  qProjectileGroups,
  qProjectilePose,
  qProjectileKnown,
  QProjectilePath,
} from '../src/render/ahri-q-projectile-history';
function fixture(): AhriQProjectileVisual {
  return {
    id: 9,
    sourceId: 1,
    team: 'red',
    launchTick: 16,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    birthAudience: ['red'],
    frames: [
      { tick: 16, x: 40, y: 0, facing: 0, sourcePoint: { x: 0, y: 0 }, audience: ['red'] },
      { tick: 17, x: 80, y: 0, facing: 0, sourcePoint: { x: 0, y: 0 }, audience: ['blue', 'red'] },
      { tick: 18, x: 100, y: 0, facing: 0, sourcePoint: { x: 0, y: 0 }, audience: ['blue', 'red'] },
      { tick: 19, x: 90, y: 0, facing: Math.PI, sourcePoint: { x: 0, y: 0 }, audience: ['red'] },
    ],
    turn: { tick: 19, point: { x: 100, y: 0 }, audience: ['blue', 'red'] },
    end: null,
  };
}
test('local phase dispatch uses only actual saved launch, turn and stop without mutating history', () => {
  const r = fixture(),
    before = structuredClone(r);
  const [out, back] = qProjectileGroups(r);
  expect(out).toMatchObject({ key: '9:missile', startTick: 16, stopTick: 19, role: 'missile' });
  expect(back).toMatchObject({
    key: '9:return',
    startTick: 19,
    stopTick: Infinity,
    role: 'return',
  });
  expect(back.seed).not.toBe(out.seed);
  expect(qProjectileGroups(r)).toEqual([out, back]);
  expect(r).toEqual(before);
  r.end = { tick: 20, point: { x: 90, y: 0 }, reason: 'match-end' };
  expect(qProjectileGroups(r)[1].stopTick).toBe(20);
  r.turn = null;
  expect(qProjectileGroups(r)).toHaveLength(1);
  expect(qProjectileGroups(r)[0].stopTick).toBe(20);
});
test('poses include the initial launch anchor, interpolate endpoints and convert mathematical heading to scene yaw', () => {
  const r = fixture();
  expect(qProjectilePose(r, 15)).toEqual({ x: 0, y: 0, facing: Math.PI / 2 });
  expect(qProjectilePose(r, 15.5)).toEqual({ x: 20, y: 0, facing: Math.PI / 2 });
  expect(qProjectilePose(r, 16.5)).toEqual({ x: 60, y: 0, facing: Math.PI / 2 });
  expect(qProjectilePose(r, 18.5)).toEqual({ x: 95, y: 0, facing: 0 });
  expect(qProjectilePose(r, 100)).toEqual(qProjectilePose(r, 19));
  expect(qProjectilePose(r, -10)).toEqual(qProjectilePose(r, 15));
  for (const t of [NaN, Infinity, -Infinity]) expect(qProjectilePose(r, t)).toBeNull();
  r.frames = [];
  expect(qProjectilePose(r, 19)).toEqual({ x: 0, y: 0, facing: Math.PI / 2 });
});
test('hidden launch can enter sight, both neighbouring endpoints guard trail births, and own-team visibility is unconditional', () => {
  const r = fixture();
  expect(qProjectileKnown(r, 15)).toBe(false);
  expect(qProjectileKnown(r, 16.5)).toBe(false);
  expect(qProjectileKnown(r, 17)).toBe(true);
  expect(qProjectileKnown(r, 17.5)).toBe(true);
  expect(qProjectileKnown(r, 18.5)).toBe(false);
  expect(qProjectileKnown(r, 19, 'red')).toBe(true);
  expect(qProjectileKnown(r, NaN, 'red')).toBe(false);
});
test('path distance includes pre-movement origin, survives seeks and extends append-only history without measuring a shrinking ribbon', () => {
  const r = fixture(),
    path = new QProjectilePath(r);
  expect(path.distance(15)).toBe(0);
  expect(path.distance(15.5)).toBe(20);
  expect(path.distance(17)).toBe(80);
  expect(path.distance(19)).toBe(110);
  expect(path.distance(17.5)).toBe(90);
  r.frames.push({ ...r.frames.at(-1)!, tick: 20, x: 70 });
  expect(path.distance(20)).toBe(130);
  expect(path.distance(18)).toBe(100);
  expect(path.distance(1e9)).toBe(130);
  expect(path.distance(NaN)).toBe(0);
  expect(new QProjectilePath(structuredClone(r)).distance(19.5)).toBe(120);
});
