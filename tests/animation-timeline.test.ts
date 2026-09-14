import { expect, it } from 'vitest';
import { advanceAnimationTimeline, animationLayers } from '../src/simulation/animation-timeline';
import type { MobilePose } from '../src/render/mobile-pose';
import { World } from '../src/simulation/world';
const durations = { idle1: 2, run: 1, attack1: 0.9, spell1: 1 };
const pose = (clip: string, time = 0, cut = false): MobilePose => ({
  clip,
  time,
  rate: 1,
  loop: clip !== 'attack1',
  kind: clip === 'run' ? 'run' : clip === 'attack1' ? 'attack' : 'idle',
  cut,
  settled: false,
});
it('samples fades by simulation tick, retaining the final interpolated frame', () => {
  let state = advanceAnimationTimeline(null, pose('idle1', 0.2), 10, durations);
  state = advanceAnimationTimeline(state, pose('run'), 11, durations);
  expect(animationLayers(state, 11, durations).map((p) => p.clip)).toEqual(['idle1']);
  const half = animationLayers(state, 13.4, durations);
  for (const layer of half) expect(layer.weight).toBeCloseTo(0.5, 12);
  expect(half[1].time).toBeCloseTo(0.2 + 3.4 / 60, 12);
  state = advanceAnimationTimeline(state, pose('run', 5 / 60), 16, durations);
  expect(state.transition).not.toBeNull();
  expect(animationLayers(state, 15.5, durations)).toHaveLength(2);
  state = advanceAnimationTimeline(state, pose('run', 6 / 60), 17, durations);
  expect(state.transition).toBeNull();
});
it('carries interrupted layers without duplicate incoming clips and preserves rest weight', () => {
  let state = advanceAnimationTimeline(null, pose('idle1'), 0, durations);
  state = advanceAnimationTimeline(state, pose('run'), 1, durations);
  state = advanceAnimationTimeline(state, pose('idle1'), 3, durations);
  expect(state.transition!.outgoing.map((p) => p.clip)).toEqual(['run']);
  expect(state.transition!.outgoing[0].weight).toBeCloseTo(2 / 4.8, 12);
  state = advanceAnimationTimeline(state, pose('attack1'), 4, durations);
  const layers = animationLayers(state, 5, durations);
  expect(layers).toHaveLength(3);
  expect(layers.reduce((sum, p) => sum + p.weight, 0)).toBeLessThan(1);
  const frozen = JSON.stringify(state);
  animationLayers(state, 4.3, durations);
  expect(JSON.stringify(state)).toBe(frozen);
  state = advanceAnimationTimeline(state, pose('spell1', 0, true), 5, durations);
  expect(state.transition).toBeNull();
});
it('persists real transition state and rejects unknown clips, duplicate layers and future timing', () => {
  const w = new World(false);
  w.units = [w.hero];
  w.nextWaveTick = Infinity;
  w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x + 1000, y: w.hero.y } });
  w.step(3);
  expect(w.hero.animationTimeline!.transition).not.toBeNull();
  const active = JSON.parse(w.snapshot());
  const duplicate = structuredClone(active);
  const outgoing = duplicate.units[0].animationTimeline.transition.outgoing;
  outgoing.push(structuredClone(outgoing[0]));
  expect(() => World.fromSnapshot(JSON.stringify(duplicate), w.battlefield)).toThrow();
  const futureStart = structuredClone(active);
  futureStart.units[0].animationTimeline.transition.startTick = futureStart.tick + 1;
  expect(() => World.fromSnapshot(JSON.stringify(futureStart), w.battlefield)).toThrow();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(8);
  restored.step(8);
  expect(restored.snapshot()).toBe(w.snapshot());
  const s = JSON.parse(w.snapshot());
  for (const clip of ['absent', 'toString', '__proto__']) {
    const bad = structuredClone(s);
    bad.units[0].animationTimeline.primary.clip = clip;
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
  const future = structuredClone(s);
  future.units[0].animationTimeline.tick = future.tick + 1;
  expect(() => World.fromSnapshot(JSON.stringify(future), w.battlefield)).toThrow();
});
