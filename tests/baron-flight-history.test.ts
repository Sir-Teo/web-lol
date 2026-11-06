import { expect, test } from 'vitest';
import { sampleBaronFlight } from '../src/render/baron-flight-history';
import type { BaronFlightFrame } from '../src/simulation/baron-attack-visuals';

const frames: BaronFlightFrame[] = [
  { tick: 100, x: 10, y: 20, facing: Math.PI - 0.1, distance: 1000, audience: ['blue'] },
  { tick: 101, x: 20, y: 40, facing: -Math.PI + 0.1, distance: 1020, audience: ['red'] },
  { tick: 102, x: 20, y: 40, facing: -Math.PI + 0.1, distance: 1020, audience: ['blue', 'red'] },
];

test('interpolates retained paths, absolute distance and the shortest facing turn', () => {
  const sample = sampleBaronFlight({ frames }, 100.5, 'blue')!;
  expect(sample).toMatchObject({ x: 15, y: 30, distance: 1010 });
  expect(sample.facing).toBeCloseTo(Math.PI, 12);
  expect(sampleBaronFlight({ frames }, 101.5, 'red')).toEqual({
    x: 20,
    y: 40,
    facing: -Math.PI + 0.1,
    distance: 1020,
  });
  sample.x = 999;
  expect(sampleBaronFlight({ frames }, 100, 'blue')?.x).toBe(10);
  expect(frames[0].x).toBe(10);
});

test('uses historical audience without revealing earlier births from later frames', () => {
  expect(sampleBaronFlight({ frames }, 100.999, 'red')).toBeNull();
  expect(sampleBaronFlight({ frames }, 101, 'red')).not.toBeNull();
  expect(sampleBaronFlight({ frames }, 101, 'blue')).toBeNull();
  expect(sampleBaronFlight({ frames }, 101.999, 'blue')).toBeNull();
  expect(sampleBaronFlight({ frames }, 102, 'blue')).not.toBeNull();
});

test('never invents retired prefixes, future visibility or invalid clocks', () => {
  for (const tick of [-Infinity, NaN, Infinity, 99.99, 102.01])
    expect(sampleBaronFlight({ frames }, tick, 'blue')).toBeNull();
  expect(sampleBaronFlight({ frames: [] }, 100, 'blue')).toBeNull();
  expect(sampleBaronFlight({ frames: [frames[0]] }, 100, 'blue')).toEqual({
    x: 10,
    y: 20,
    facing: Math.PI - 0.1,
    distance: 1000,
  });
  expect(sampleBaronFlight({ frames: [frames[0]] }, 100.1, 'blue')).toBeNull();
});
