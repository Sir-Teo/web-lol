import { expect, test } from 'vitest';
import fixtures from '../docs/reference/source-trail-unsmoothed-samples.json';
import { sourceTrailRibbon, type SourceTrailPoint } from '../src/render/source-trail-ribbon';
for (const fixture of fixtures.samples)
  test(`unsmoothed trail matches independent writer: ${fixture.name}`, () => {
    const actual = sourceTrailRibbon(
      fixture.points as unknown as SourceTrailPoint[],
      fixture.cutoff,
      undefined,
      3,
      fixture.view as [number, number, number] | null,
      0
    );
    expect(actual).toHaveLength(fixture.expected.length);
    actual.forEach((vertex, index) => {
      const reference = fixture.expected[index];
      for (const field of ['position', 'uv', 'color', 'lookup'] as const)
        vertex[field].forEach((value, axis) =>
          expect(value).toBeCloseTo(reference[field][axis], 5)
        );
      expect(vertex.erosion).toBeCloseTo(reference.erosion, 6);
    });
  });

test('smoothing off preserves the kink and raw arbitrary-side width', () => {
  const fixture = fixtures.samples.find((s) => s.name === 'arbitrary-raw-sides')!;
  const points = fixture.points as unknown as SourceTrailPoint[];
  const vertices = sourceTrailRibbon(points, 1000, undefined, 3, null, 0);
  expect(vertices[1].position).toEqual([4, 0, 0]);
  expect(vertices[0].position).toEqual([10, 0, 4]);
  expect(vertices).toEqual(sourceTrailRibbon(points, 1000, undefined, 0, null, 0));
});

test('unsupported traversal modes reject rather than silently using mode one', () => {
  expect(() =>
    sourceTrailRibbon(
      fixtures.samples[0].points as unknown as SourceTrailPoint[],
      1000,
      undefined,
      3,
      null,
      2 as 0
    )
  ).toThrow(RangeError);
});

test('unsmoothed camera trails restart framing after a hidden birth', () => {
  const original = fixtures.samples[0].points as unknown as SourceTrailPoint[];
  const points = [
    ...original,
    ...original.map((point) => ({
      ...point,
      position: point.position.map((value) => value + 100) as [number, number, number],
    })),
  ];
  points[2] = { ...points[2], visible: false };
  const view = [0, 1, 0] as const;
  expect(sourceTrailRibbon(points, 1000, undefined, 3, view, 0)).toEqual([
    ...sourceTrailRibbon(points.slice(0, 2), 1000, undefined, 3, view, 0),
    ...sourceTrailRibbon(points.slice(3), 1000, undefined, 3, view, 0),
  ]);
});
