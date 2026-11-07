import { expect, test } from 'vitest';
import { SourceBindingTimeline } from '../src/render/source-binding-timeline';
import { SourceParticleFrame } from '../src/render/source-particle-frame';
import type { SourceValueDefinition } from '../src/render/source-value';

const zero = {
  constant: [0, 0, 0],
  times: [0],
  values: [[0, 0, 0]],
  authoredKeyCount: 0,
  probabilities: [],
};
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const binding: SourceValueDefinition = {
  constant: [1],
  times: [0, 0.4, 1],
  values: [[1], [0.2], [0.8]],
  authoredKeyCount: 3,
  probabilities: [],
};
const root = (time: number) => [1200 * time, Math.sin(time * 3) * 100, 60 * time * time];
function reference(stop = Infinity, linger = 0) {
  const frame = new SourceParticleFrame({
    emitterSpace: false,
    particleLocalOrientation: false,
    bindWeight: binding,
    worldAcceleration: zero,
  });
  let bound = new Float32Array(3);
  const rows = [{ bound: bound.slice(), velocity: new Float32Array(3) }];
  for (let step = 1; step <= 90; step++) {
    const now = (step + 1) / 60,
      a = root(now),
      b = root(step / 60);
    const result = frame.sample({
      position: [0, 0, 0],
      previousPlaced: [0, 0, 0],
      bound,
      anchor: [0, 0, 0],
      birthFrame: identity,
      currentYaw: identity,
      emitterPosition: [0, 0, 0],
      worldBasis: identity,
      worldOffset: [0, 0, 0],
      worldHud: false,
      orbit: null,
      moved: a.map((v, i) => v - b[i]),
      dt: 1 / 60,
      fresh: false,
      age: now - 1 / 60,
      life: now >= stop ? Math.min(1.5, Math.max(linger, 0)) : 1.5,
    });
    bound = result.bound;
    rows.push({ bound: result.bound, velocity: result.travel });
  }
  return rows;
}

test('binding timeline matches replay of the independently verified source-frame kernel', () => {
  for (const [stop, linger] of [
    [Infinity, 0],
    [0.5, 1.1],
    [0.5, 0],
  ]) {
    const track = new SourceBindingTimeline(binding, 1.5, 1 / 60, 1 / 60, root, 90);
    const expected = reference(stop, linger);
    for (const step of [0, 1, 13, 29, 50, 89]) {
      const actual = track.sample(step, 0, stop, linger);
      expect(actual.bound).toEqual(expected[step].bound);
      expect(actual.velocity).toEqual(expected[step].velocity);
    }
    const middle = track.sample(13, 0.25, stop, linger);
    expect(middle.bound).toEqual(
      Float32Array.from(expected[13].bound, (v, i) => v + (expected[14].bound[i] - v) * 0.25)
    );
    expect(track.computedSteps).toBe(89);
  }
});

test('binding stop changes replay cached rows and returned buffers cannot mutate the cache', () => {
  const track = new SourceBindingTimeline(binding, 1.5, 1 / 60, 1 / 60, root, 90);
  const original = track.sample(50, 0);
  const stopped = track.sample(50, 0, 0.5, 1.1);
  expect(stopped.bound).toEqual(reference(0.5, 1.1)[50].bound);
  expect(stopped.bound).not.toEqual(original.bound);
  stopped.bound.fill(999);
  stopped.velocity.fill(999);
  expect(track.sample(50, 0).bound).toEqual(original.bound);
});

test('zero binding avoids root sampling and invalid seeks or roots reject', () => {
  const none = new SourceBindingTimeline(
    { ...binding, values: [[0], [0], [0]] },
    1,
    0,
    0,
    () => {
      throw Error('Zero binding must not sample root');
    },
    60
  );
  expect(none.sample(59, 0.5).bound).toEqual(new Float32Array(3));
  expect(none.computedSteps).toBe(0);
  for (const [step, fraction] of [
    [-1, 0],
    [1.5, 0],
    [0, NaN],
    [60, 0.5],
  ])
    expect(() => none.sample(step, fraction)).toThrow();
  const bad = new SourceBindingTimeline(binding, 1, 0, 0, () => [NaN, 0, 0], 60);
  expect(() => bad.sample(1, 0)).toThrow('root');
});

test('constant binding uses the declared constant when no keys were authored', () => {
  const constant = { ...binding, constant: [1], times: [0], values: [[0]], authoredKeyCount: 0 };
  const track = new SourceBindingTimeline(constant, 1, 0, 0, (time) => [time * 60, 0, 0], 60);
  expect(track.sample(1, 0).bound).toEqual(new Float32Array([1, 0, 0]));
});
