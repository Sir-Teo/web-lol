import { expect, test } from 'vitest';
import { sourceSteppedMotion } from '../src/render/source-stepped-motion';
import { SourceMotionTimeline } from '../src/render/source-motion-timeline';
function reference(
  position: number[],
  velocity: number[],
  drag: number[],
  steps: number,
  fraction: number
) {
  let state = {
    position: Float32Array.from(position),
    velocity: Float32Array.from(velocity),
    moving: Float32Array.from(velocity),
    fresh: false as const,
  };
  const step = () =>
    sourceSteppedMotion({
      position: state.position,
      velocity: state.velocity,
      birthAcceleration: [0, 0, 0],
      acceleration: [0, 0, 0],
      carriedVelocity: [0, 0, 0],
      birthDrag: drag,
      drag: [0, 0, 0],
      dt: 1 / 60,
      fresh: false,
    });
  for (let n = 0; n < steps; n++) state = step();
  if (fraction) {
    const next = step();
    return {
      position: Float32Array.from(state.position, (v, i) => v + (next.position[i] - v) * fraction),
      velocity: Float32Array.from(state.velocity, (v, i) => v + (next.velocity[i] - v) * fraction),
      moving: Float32Array.from(state.moving, (v, i) => v + (next.moving[i] - v) * fraction),
    };
  }
  return { position: state.position, velocity: state.velocity, moving: state.moving };
}
test('bounded float32 tracks match independent source-step replay for random seeks and partial frames', () => {
  const position = [-50, 2, 0.25],
    velocity = [120, 75, -40],
    drag = [2, 4, 0],
    track = new SourceMotionTimeline(position, velocity, drag, 70);
  for (const [steps, fraction] of [
    [0, 0],
    [1, 0.2],
    [50, 0.75],
    [4, 0],
    [50, 0],
    [60, 0.99],
    [12, 0.3],
  ]) {
    expect(track.sample(steps, fraction)).toEqual(
      reference(position, velocity, drag, steps, fraction)
    );
  }
  const done = track.computedSteps;
  track.sample(5, 0.5);
  expect(track.computedSteps).toBe(done);
  const output = track.sample(5, 0.5);
  output.position[0] = 999;
  output.velocity[1] = 999;
  output.moving[2] = 999;
  expect(track.sample(5, 0.5)).toEqual(reference(position, velocity, drag, 5, 0.5));
});
test('stationary tracks retain copied inputs without allocating motion rows or exposing shared arrays', () => {
  const position = [1, 2, 3],
    track = new SourceMotionTimeline(position, [0, 0, 0], [2, 4, 1], 10);
  position[0] = 999;
  const a = track.sample(9, 0.5);
  expect(Array.from(a.position)).toEqual([1, 2, 3]);
  expect(track.computedSteps).toBe(0);
  a.position[0] = 999;
  expect(Array.from(track.sample(1, 0).position)).toEqual([1, 2, 3]);
});
test('invalid vectors, extents and seeks fail closed', () => {
  expect(() => new SourceMotionTimeline([0, 0], [0, 0, 0], [0, 0, 0], 10)).toThrow();
  expect(() => new SourceMotionTimeline([Infinity, 0, 0], [0, 0, 0], [0, 0, 0], 10)).toThrow();
  expect(() => new SourceMotionTimeline([1e100, 0, 0], [0, 0, 0], [0, 0, 0], 10)).toThrow();
  const track = new SourceMotionTimeline([0, 0, 0], [1, 0, 0], [0, 0, 0], 2);
  for (const [steps, fraction] of [
    [-1, 0],
    [1, -0.1],
    [2, 0.1],
    [1, NaN],
  ])
    expect(() => track.sample(steps, fraction)).toThrow();
});
