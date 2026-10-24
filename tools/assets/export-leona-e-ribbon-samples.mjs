/** Execute the pinned external JavaScript ribbon helper, never a native client.
 * Golden arrays are independent of this project's adapter and its tests. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const pinPath = 'docs/reference/leona-e-kernel-readers.json',
  pin = JSON.parse(fs.readFileSync(pinPath)),
  source = pin.files.find((f) => f.path.endsWith('/ribbon.ts')),
  bytes = fs.readFileSync(source.path),
  hash = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes), source.sha256);
const exported = {};
const compiled = ts.transpileModule(bytes.toString(), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'exports', compiled)((name) => {
  if (name === '@/modules/viewport') return { AXIS_SIGN: [1, 1, 1] };
  if (name.endsWith('/enums'))
    return { TRAIL_SMOOTHING: { off: 0, frontToBack: 1, backToFront: 2 } };
  // The selected pure writer uses none of Three, beam helpers or upload hooks.
  return {};
}, exported);
const point = (x, z = 0, side = [0, 0, 1], wakeU = x / 805) => ({
  profileIndex: 11,
  ordinal: 0,
  bornTick: 0,
  position: [x, 0, z],
  halfWidth: 2,
  wakeU,
  uvOffset: [0, 0],
  uvScale: [1, 1],
  side,
  color: [1, 0.7, 0.2, 0.5],
  lookup: [0.25, 0.75],
  erosion: 0.4,
  visible: true,
});
const cases = [
  ['straight', [point(0), point(10), point(20)], 1000],
  ['curved', [point(0), point(10, 20), point(20), point(30, -10), point(40)], 1000],
  [
    'particle-sides',
    [point(0, 0, [1, 0, 0]), point(10, 0, [0, 0, 1]), point(20, 0, [-1, 0, 0])],
    1000,
  ],
  [
    'opposite-sides',
    [point(0, 0, [1, 0, 0]), point(10, 0, [-1, 0, 0]), point(20, 0, [1, 0, 0])],
    1000,
  ],
  ['duplicate-births', [point(0), point(0), point(10)], 1000],
  ['cutoff-boundary', [point(0), point(10), point(20)], 20],
  [
    'wake-parity',
    [point(0, 0, [0, 0, 1], 4.5), point(10, 0, [0, 0, 1], 4.25), point(20, 0, [0, 0, 1], 4)],
    1000,
  ],
];
const samples = cases.map(([name, points, cutoff]) => {
  const held = exported.strand(points.length),
    oldest = [...points].reverse();
  held.count = points.length;
  oldest.forEach((p, i) => {
    held.position.set(p.position, i * 3);
    held.width[i] = p.halfWidth;
    held.color.set(p.color, i * 4);
    held.side.set(p.side, i * 3);
    held.tiling.set([805, 0], i * 2);
    held.odometer[i] = p.wakeU * 805;
    held.uv.set([0, ...p.uvScale, ...p.uvOffset, 0, 0], i * 7);
    held.lookup.set(p.lookup, i * 2);
    held.erode[i] = p.erosion;
  });
  const floats = (n) => new Float32Array(points.length * 2 * n),
    out = {
      position: floats(3),
      uv: floats(2),
      alphaUv: floats(2),
      cell: floats(2),
      tint: floats(4),
      lookup: floats(2),
      erode: floats(1),
      multUv: floats(2),
      multCell: floats(2),
      index: new Uint32Array((points.length - 1) * 6),
    },
    cursor = { vertex: 0, index: 0 };
  exported.writeTrail(
    held,
    {
      view: null,
      wake: true,
      smoothing: 1,
      reach: 3,
      cutoff,
      layers: { base: { center: [0.5, 0.5], flipU: false, flipV: false }, mult: null },
    },
    out,
    cursor
  );
  const read = (array, index, n) => Array.from(array.subarray(index * n, index * n + n));
  const expected = Array.from(out.index.subarray(0, cursor.index), (i) => ({
    position: read(out.position, i, 3),
    uv: read(out.uv, i, 2),
    color: read(out.tint, i, 4),
    lookup: read(out.lookup, i, 2),
    erosion: out.erode[i],
  }));
  return { name, points, cutoff, expected };
});
const result = {
  scope:
    'External helper arrays after source reflection; AXIS_SIGN is identity because input points/sides already use reflected world coordinates. No native execution or browser/GPU parity claim.',
  revision: pin.ribbonRevision,
  readerSha256: source.sha256,
  readersPinSha256: hash(fs.readFileSync(pinPath)),
  samples,
};
const raw = JSON.stringify(result, null, 2) + '\n',
  output = 'docs/reference/leona-e-ribbon-samples.json';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else fs.writeFileSync(output, raw, { flag: 'wx' });
console.log(
  JSON.stringify({
    result: 'passed',
    samples: samples.length,
    readerSha256: source.sha256,
    nativeExecuted: false,
  })
);
