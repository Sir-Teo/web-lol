import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { AhriEVisualHistory } from '../src/simulation/ahri-e-visual-history';
import { eVisualGameplaySamples } from './helpers/ahri-e-visual-gameplay';
import {
  eVisualGroups,
  eVisualPose,
  eVisualKnown,
  eVisualDistance,
} from '../src/render/ahri-e-history';

const samples = eVisualGameplaySamples(World, PRACTICE_FIXTURE, 'hit');
function fixture(): AhriEVisualHistory {
  return JSON.parse(samples.find((s) => s.tick === 45)!.snapshot).ahriEVisuals[0];
}
test('E dispatch joins all five systems with distinct stable keys and actual control clocks', () => {
  const r = fixture(),
    groups = eVisualGroups(r);
  expect(groups.map((g) => g.system)).toEqual([
    'Ahri_E_cas',
    'Ahri_E_mis',
    'Ahri_E_tar',
    'Ahri_E_buf',
    '{44fc6ec4}',
  ]);
  expect(new Set(groups.map((g) => g.key)).size).toBe(5);
  expect(new Set(groups.map((g) => g.seed)).size).toBe(5);
  expect(eVisualGroups(structuredClone(r)).map((g) => g.seed)).toEqual(groups.map((g) => g.seed));
  expect(groups[0]).toMatchObject({ startTick: r.castTick, stopTick: Infinity });
  expect(groups[1]).toMatchObject({
    startTick: r.launch!.tick,
    stopTick: r.stop!.tick,
    radius: r.launch!.radius,
  });
  expect(groups[2]).toMatchObject({
    startTick: r.hit!.tick,
    stopTick: Infinity,
    radius: r.hit!.targetRadius,
  });
  for (const g of groups.slice(3))
    expect(g).toMatchObject({
      startTick: r.buff!.control.startTick,
      stopTick: r.buff!.control.endTick,
    });
  r.buff!.stop = { tick: 45, reason: 'replaced' };
  expect(
    eVisualGroups(r)
      .slice(3)
      .map((g) => g.stopTick)
  ).toEqual([45, 45]);
});
test('a canceled windup dispatches only the cast system and carries its actual stop', () => {
  const r = JSON.parse(
    eVisualGameplaySamples(World, PRACTICE_FIXTURE, 'windup-death').find((s) => s.tick === 15)!
      .snapshot
  ).ahriEVisuals[0];
  expect(eVisualGroups(r)).toHaveLength(1);
  expect(eVisualGroups(r)[0]).toMatchObject({ system: 'Ahri_E_cas', stopTick: 5 });
});
test('E flight retains the pre-move launch root and separates contact from the target body root', () => {
  const r = fixture(),
    [, flight, hit] = eVisualGroups(r),
    birth = r.launch!,
    first = r.flightFrames[0];
  expect(eVisualPose(flight, birth.tick - 1)).toMatchObject({ x: birth.point.x, y: birth.point.y });
  expect(eVisualPose(flight, birth.tick)).toMatchObject({ x: first.point.x, y: first.point.y });
  expect(eVisualPose(flight, birth.tick - 0.5)!.x).toBe((birth.point.x + first.point.x) / 2);
  expect(eVisualPose(flight, 1e6)).toMatchObject({ x: r.stop!.point.x, y: r.stop!.point.y });
  expect(eVisualPose(hit, r.hit!.tick)).toMatchObject({
    x: r.hit!.targetPoint.x,
    y: r.hit!.targetPoint.y,
  });
  expect(r.hit!.point).not.toEqual(r.hit!.targetPoint);
});
test('target visibility never inherits caster-team knowledge and hidden neighbours reject interpolated births', () => {
  const r = fixture();
  r.targetFrames[0] = { ...r.targetFrames[0], audience: ['red'] };
  r.targetFrames[1] = { ...r.targetFrames[1], audience: ['blue', 'red'] };
  const [, flight, , buff] = eVisualGroups(r),
    tick = r.targetFrames[0].tick;
  expect(eVisualKnown(flight, flight.startTick, 'blue')).toBe(true);
  expect(eVisualKnown(buff, tick, 'blue')).toBe(false);
  expect(eVisualKnown(buff, tick + 0.5, 'blue')).toBe(false);
  expect(eVisualKnown(buff, tick + 1, 'blue')).toBe(true);
  expect(eVisualKnown(buff, tick, 'red')).toBe(true);
});
test('same-tick audience replacement invalidates copied flight anchors and pose caches', () => {
  const r = fixture(),
    flight = eVisualGroups(r)[1];
  expect(eVisualKnown(flight, r.launch!.tick - 1, 'blue')).toBe(true);
  r.launch!.audience = ['red'];
  expect(eVisualKnown(flight, r.launch!.tick - 1, 'blue')).toBe(false);
  const cast = eVisualGroups(r)[0],
    tick = r.sourceFrames.at(-1)!.tick;
  expect(eVisualPose(cast, tick)!.x).toBe(r.sourceFrames.at(-1)!.point.x);
  r.sourceFrames[r.sourceFrames.length - 1] = {
    ...r.sourceFrames.at(-1)!,
    point: { x: 123, y: 456 },
    audience: ['red'],
  };
  expect(eVisualPose(cast, tick)).toMatchObject({ x: 123, y: 456 });
  expect(eVisualKnown(cast, tick, 'blue')).toBe(false);
});
test('flight distance is seek-order independent and invalid clocks cannot reveal poses', () => {
  const r = fixture(),
    flight = eVisualGroups(r)[1];
  const distance = eVisualDistance(flight, 1e6);
  expect(distance).toBeCloseTo(
    Math.hypot(r.stop!.point.x - r.launch!.point.x, r.stop!.point.y - r.launch!.point.y),
    10
  );
  expect(eVisualDistance(flight, flight.startTick - 1)).toBe(0);
  expect(eVisualDistance(flight, 1e6)).toBe(distance);
  for (const tick of [NaN, Infinity, -Infinity]) {
    expect(eVisualPose(flight, tick)).toBeNull();
    expect(eVisualKnown(flight, tick)).toBe(false);
    expect(eVisualDistance(flight, tick)).toBe(0);
  }
});
test('target lifetime endings freeze hit and buff roots after later body movement', () => {
  const r: AhriEVisualHistory = JSON.parse(
    eVisualGameplaySamples(World, PRACTICE_FIXTURE, 'target-death').find((s) => s.tick === 60)!
      .snapshot
  ).ahriEVisuals[0];
  expect(r.targetEnd!.tick).toBe(50);
  const groups = eVisualGroups(r).filter((g) => g.role === 'hit' || g.role === 'buff');
  for (const g of groups)
    expect(eVisualPose(g, 10000)).toMatchObject({
      x: r.targetEnd!.pose.point.x,
      y: r.targetEnd!.pose.point.y,
    });
  expect(groups.filter((g) => g.role === 'buff').map((g) => g.stopTick)).toEqual([50, 50]);
  const saved = JSON.stringify(r);
  for (const g of groups) {
    eVisualPose(g, 50.5);
    eVisualDistance(g, 60);
    eVisualKnown(g, 60);
  }
  expect(JSON.stringify(r)).toBe(saved);
});

test('body facing takes the short arc while preserving exact saved endpoints', () => {
  const r = fixture(),
    a = r.sourceFrames[0],
    b = r.sourceFrames[1];
  r.sourceFrames[0] = { ...a, facing: Math.PI - 0.1 };
  r.sourceFrames[1] = { ...b, facing: -Math.PI + 0.1 };
  const cast = eVisualGroups(r)[0];
  expect(eVisualPose(cast, a.tick)!.facing).toBe(Math.PI - 0.1);
  expect(eVisualPose(cast, a.tick + 0.5)!.facing).toBeCloseTo(Math.PI, 12);
  expect(eVisualPose(cast, b.tick)!.facing).toBe(-Math.PI + 0.1);
});
