import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import samples from '../docs/reference/source-default-trail-samples.json';
import { packedSourceTrailRibbon as ribbon } from '../src/render/source-packed-trail-ribbon';
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
for (const sample of samples.samples)
  test('ordinary ribbon matches pinned writer ' + sample.name, () => {
    expect(
      serialize(
        ribbon(
          sample.points,
          sample.cutoff,
          sample.view,
          sample.smoothing as 0 | 1 | 2,
          sample.reach,
          false
        )
      )
    ).toEqual(sample.expected);
  });
test('ordinary ribbon fixtures pin their independent producer and external writer', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(hash('tools/assets/export-default-trail-samples.mjs')).toBe(samples.producerSha256);
  expect(hash('docs/reference/leona-e-kernel-readers.json')).toBe(samples.pinFileSha256);
  expect(samples.reader.sha256).toBe(
    'ada3d66b955dee7916f10e5b76417a9d7985bbbca337afcd551a7f30fa5cbe68'
  );
  expect(samples.wake).toBe(false);
  expect(samples.samples).toHaveLength(12);
});
test('ordinary UV distance ignores unavailable lifetime odometers while WAKE preserves them', () => {
  const sample = samples.samples.find((s) => s.name === 'curved-0-3')!;
  const changed = sample.points.map((p) => ({ ...p, odometer: p.odometer + 1e7 }));
  expect(serialize(ribbon(changed, 0, null, 0, 3, false))).toEqual(sample.expected);
  expect(serialize(ribbon(changed, 0, null, 0, 3, true))).not.toEqual(
    serialize(ribbon(sample.points, 0, null, 0, 3, true))
  );
  expect(() => ribbon(sample.points, 0, null, 0, 3, 0 as unknown as boolean)).toThrow();
});
