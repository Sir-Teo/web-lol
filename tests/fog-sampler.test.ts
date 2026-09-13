import { expect, test } from 'vitest';
import { FogSampler } from '../src/render/fog-sampler';
import { seenFrom, type VisionSource } from '../src/simulation/vision';
import type { Vec2 } from '../src/simulation/math';

const size = 32,
  span = 800;
function reference(sources: VisionSource[], sight: (a: Vec2, b: Vec2) => boolean) {
  return Uint8Array.from(
    { length: size * size },
    (_, i) =>
      +seenFrom(
        {
          x: (((i % size) + 0.5) / size - 0.5) * span,
          y: ((Math.floor(i / size) + 0.5) / size - 0.5) * span,
        },
        sources,
        sight
      )
  );
}

test('exact cached union matches fresh rays through movement, overlap loss, radius changes and expiry', () => {
  const sampler = new FogSampler(size, span);
  const sight = (a: Vec2, b: Vec2) => Math.sign(a.x) === Math.sign(b.x) || Math.abs(b.y) < 30;
  const a = { x: -100, y: 0, radius: 240 },
    b = { x: 100, y: 20, radius: 250 };
  const steps: VisionSource[][] = [
    [a, b],
    [b, a],
    [b],
    [a],
    [{ ...a, x: -99.999 }],
    [{ ...a, radius: 300 }],
    [a, { ...b, unobstructed: true }],
    [a],
    [],
    [a, a],
    [{ x: 10000, y: 10000, radius: 3 }],
  ];
  for (const sources of steps)
    expect(sampler.sample(sources, sight, 0)).toEqual(reference(sources, sight));
});

test('unchanged observers issue no new rays and cache retains only currently present sources', () => {
  const sampler = new FogSampler(size, span);
  let calls = 0;
  const sight = () => {
    calls++;
    return true;
  };
  const source = { x: 0, y: 0, radius: 100 };
  sampler.sample([source], sight, 0);
  expect(calls).toBeGreaterThan(0);
  calls = 0;
  sampler.sample([source], sight, 0);
  expect(calls).toBe(0);
  sampler.sample([], sight, 0);
  sampler.sample([source], sight, 0);
  expect(calls).toBeGreaterThan(0);
});

test('revision and query changes invalidate blocked and visible results; absent revision never reuses rays', () => {
  const sampler = new FogSampler(size, span),
    sources = [{ x: 0, y: 0, radius: 300 }];
  let open = false;
  const sight = () => open;
  expect(sampler.sample(sources, sight, 0)).toEqual(reference(sources, sight));
  open = true;
  expect(sampler.sample(sources, sight, 1)).toEqual(reference(sources, sight));
  open = false;
  expect(sampler.sample(sources, sight)).toEqual(reference(sources, sight));
  open = true;
  expect(sampler.sample(sources, sight)).toEqual(reference(sources, sight));
  const blocked = () => false;
  expect(sampler.sample(sources, blocked, 1)).toEqual(reference(sources, blocked));
});
