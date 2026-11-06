import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import samples from '../docs/reference/source-packed-trail-samples.json';
import {
  packedSourceTrailRibbon as ribbon,
  type PackedTrailPoint,
} from '../src/render/source-packed-trail-ribbon';
const serialize = (vertices: ReturnType<typeof ribbon>) =>
  vertices.map((v) => ({
    position: Array.from(v.position),
    uv: Array.from(v.uv),
    cell: Array.from(v.cell),
    multUv: v.multUv && Array.from(v.multUv),
    multCell: v.multCell && Array.from(v.multCell),
    color: Array.from(v.color),
    lookup: Array.from(v.lookup),
    erosion: v.erosion,
  }));
for (const s of samples.samples)
  test('packed writer matches independent external fixture ' + s.name, () => {
    expect(
      serialize(ribbon(s.points, s.cutoff, s.view, s.smoothing as 0 | 1 | 2, s.reach))
    ).toEqual(s.expected);
  });
test('fixture pins its producer and the unchanged external writer identity', () => {
  const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  expect(hash('tools/assets/export-packed-trail-samples.mjs')).toBe(samples.producerSha256);
  expect(hash('docs/reference/leona-e-kernel-readers.json')).toBe(samples.pinFileSha256);
  expect(samples.reader.sha256).toBe(
    'ada3d66b955dee7916f10e5b76417a9d7985bbbca337afcd551a7f30fa5cbe68'
  );
  expect(samples.samples).toHaveLength(42);
});
test('visibility gaps split before filtering and retain independent secondary coordinates', () => {
  const s = samples.samples.find((s) => s.name === 'gap-2-3')!;
  const output = ribbon(s.points, 0, s.view, 2, 3);
  expect(serialize(output)).toEqual([
    ...serialize(ribbon(s.points.slice(0, 3), 0, s.view, 2, 3)),
    ...serialize(ribbon(s.points.slice(4), 0, s.view, 2, 3)),
  ]);
  expect(output.some((v) => v.multUv![0] !== v.uv[0])).toBe(true);
  output[0].color[0] = 999;
  expect(serialize(ribbon(s.points, 0, s.view, 2, 3))).toEqual(s.expected);
});
test('invalid policies and nonfinite packed points fail closed', () => {
  const points = samples.samples[0].points;
  for (const smoothing of [-1, 3, NaN])
    expect(() => ribbon(points, 0, null, smoothing as 0)).toThrow();
  for (const cutoff of [-1, NaN, Infinity]) expect(() => ribbon(points, cutoff, null, 0)).toThrow();
  for (const reach of [-1, 0.5, 4]) expect(() => ribbon(points, 0, null, 0, reach)).toThrow();
  for (const view of [
    [0, 0, 0],
    [NaN, 1, 0],
    [1, 2],
  ])
    expect(() => ribbon(points, 0, view, 0)).toThrow();
  for (const patch of [
    { position: [Infinity, 0, 0] },
    { tiling: [1] },
    { color: [1, 1, NaN, 1] },
    { erosion: Infinity },
    { profileIndex: 999 },
    { uv: { ...points[0].uv, turn: NaN } },
  ]) {
    const changed: PackedTrailPoint[] = structuredClone(points);
    Object.assign(changed[1], patch);
    expect(() => ribbon(changed, 0, null, 0)).toThrow();
  }
  expect(ribbon([], 0, null, 2)).toEqual([]);
  expect(ribbon(points.slice(0, 1), 0, null, 2)).toEqual([]);
  expect(
    ribbon(
      points.map((p) => ({ ...p, visible: false })),
      0,
      null,
      2
    )
  ).toEqual([]);
});
