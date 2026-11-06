import { expect, test } from 'vitest';
import samples from '../docs/reference/source-camera-trail-samples.json';
import { sourceTrailRibbon, type SourceTrailPoint } from '../src/render/source-trail-ribbon';

const fixturePoints = (points: (typeof samples.samples)[number]['points']): SourceTrailPoint[] =>
  points.map((point) => ({
    ...point,
    position: [point.position[0], point.position[1], point.position[2]],
    side: [point.side[0], point.side[1], point.side[2]],
    lookup: [point.lookup[0], point.lookup[1]],
  }));

for (const sample of samples.samples)
  test(`camera trail matches independently pinned writer: ${sample.name}`, () => {
    const actual = sourceTrailRibbon(
      fixturePoints(sample.points),
      sample.cutoff,
      undefined,
      3,
      sample.view as [number, number, number]
    );
    expect(actual).toHaveLength(sample.expected.length);
    actual.forEach((vertex, index) => {
      const reference = sample.expected[index];
      for (const field of ['position', 'uv', 'color', 'lookup'] as const)
        vertex[field].forEach((value, component) =>
          expect(value).toBeCloseTo(reference[field][component], 5)
        );
      expect(vertex.erosion).toBeCloseTo(reference.erosion, 6);
    });
  });

const fixture = fixturePoints(samples.samples[0].points);
test('hidden births split camera trail runs before smoothing and tangent framing', () => {
  const points = [
    ...fixture,
    ...fixture.map((p) => ({
      ...p,
      position: p.position.map((v) => v + 100) as [number, number, number],
    })),
  ];
  points[2] = { ...points[2], visible: false };
  const view = [0, 1, 0] as const;
  const combined = sourceTrailRibbon(points, 1000, undefined, 3, view);
  const separate = [
    sourceTrailRibbon(points.slice(0, 2), 1000, undefined, 3, view),
    sourceTrailRibbon(points.slice(3), 1000, undefined, 3, view),
  ].flat();
  // WAKE's shared even base is zero for this fixture, so all vertex fields match.
  expect(combined).toEqual(separate);
});

for (const view of [
  [0, 0, 0],
  [NaN, 1, 0],
  [0, Infinity, 0],
  [1, 1],
  [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
])
  test(`invalid camera direction rejects ${view}`, () => {
    expect(() =>
      sourceTrailRibbon(fixture, 1000, undefined, 3, view as [number, number, number])
    ).toThrow(RangeError);
  });
