/** Independent packed-trail fixtures from the hash-pinned external writer. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const pinFile = 'docs/reference/leona-e-kernel-readers.json';
const pin = JSON.parse(fs.readFileSync(pinFile)).files.find((p) => p.path.endsWith('/ribbon.ts'));
const sourceFile = '.cache/baron-emission-readers/rendering/utils/ribbon.ts';
const bytes = fs.readFileSync(sourceFile);
assert.equal(bytes.length, pin.bytes);
assert.equal(hash(bytes), pin.sha256);
const exports = {};
new Function(
  'require',
  'exports',
  ts.transpileModule(bytes.toString(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)((name) => {
  if (name === '@/modules/viewport') return { AXIS_SIGN: [1, 1, 1] };
  if (name.endsWith('/enums'))
    return { TRAIL_SMOOTHING: { off: 0, frontToBack: 1, backToFront: 2 } };
  return {};
}, exports);
const uv = (i) => ({
  turn: i * 0.07,
  scaleU: 1.1 + i * 0.1,
  scaleV: 0.8 + i * 0.03,
  offsetU: -0.13 + i * 0.017,
  offsetV: 0.21 - i * 0.023,
  cellU: 0.25,
  cellV: 0.5,
});
const point = (i, x, y, z) => ({
  profileIndex: 4,
  position: [x, y, z],
  side: [1 + i * 0.01, 0.2 - i * 0.07, i % 2 ? 0.7 : -0.5],
  halfWidth: 2 + i * 0.31,
  tiling: [805 + i * 0.1, i % 3 === 0 ? 0 : i % 3 === 1 ? 3 : -1.3],
  odometer: 3700 + i * 37.123,
  uv: uv(i),
  multUv: uv(-i - 2),
  color: [0.8 + i * 0.07, 0.7, 1.3, 0.6 - i * 0.02],
  lookup: [0.13 + i * 0.1, 0.77],
  erosion: 0.25 + i * 0.03,
  visible: true,
});
const curves = [
  ['straight', Array.from({ length: 5 }, (_, i) => point(i, i * 10, 0, 0)), 0, null],
  [
    'curved',
    Array.from({ length: 7 }, (_, i) => point(i, i * 10.13, Math.sin(i) * 7, Math.cos(i) * 20)),
    0,
    null,
  ],
  [
    'camera',
    Array.from({ length: 7 }, (_, i) => point(i, i * 10.13, Math.sin(i) * 7, Math.cos(i) * 20)),
    0,
    [1, 2, -3],
  ],
  ['end-on', Array.from({ length: 5 }, (_, i) => point(i, i * 10, 0, 0)), 0, [1, 0, 0]],
  ['duplicates', Array.from({ length: 5 }, (_, i) => point(i, 0, 0, 0)), 0, [0, 1, 0]],
  ['cutoff', Array.from({ length: 7 }, (_, i) => point(i, i * 10, 0, 0)), 25, null],
  [
    'gap',
    Array.from({ length: 7 }, (_, i) => ({
      ...point(i, i * 10, 0, (i % 2) * 12),
      visible: i !== 3,
    })),
    0,
    [1, 2, -3],
  ],
];
const packedUv = (u) => [u.turn, u.scaleU, u.scaleV, u.offsetU, u.offsetV, u.cellU, u.cellV];
const runWriter = (points, cutoff, view, smoothing, reach) => {
  if (points.length < 2) return [];
  const held = exports.strand(points.length);
  held.count = points.length;
  points.forEach((p, i) => {
    held.position.set(p.position, i * 3);
    held.width[i] = p.halfWidth;
    held.side.set(p.side, i * 3);
    held.tiling.set(p.tiling, i * 2);
    held.odometer[i] = p.odometer;
    held.uv.set(packedUv(p.uv), i * 7);
    held.multUv.set(packedUv(p.multUv), i * 7);
    held.color.set(p.color, i * 4);
    held.lookup.set(p.lookup, i * 2);
    held.erode[i] = p.erosion;
  });
  const floats = (n) => new Float32Array(points.length * 2 * n);
  const out = {
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
  };
  const cursor = { vertex: 0, index: 0 },
    layer = { center: [0.5, 0.5], flipU: false, flipV: false };
  exports.writeTrail(
    held,
    { view, wake: true, smoothing, reach, cutoff, layers: { base: layer, mult: layer } },
    out,
    cursor
  );
  const read = (a, i, n) => Array.from(a.subarray(i * n, i * n + n));
  return Array.from(out.index.subarray(0, cursor.index), (i) => ({
    position: read(out.position, i, 3),
    uv: read(out.uv, i, 2),
    cell: read(out.cell, i, 2),
    multUv: read(out.multUv, i, 2),
    multCell: read(out.multCell, i, 2),
    color: read(out.tint, i, 4),
    lookup: read(out.lookup, i, 2),
    erosion: out.erode[i],
  }));
};
const samples = [];
for (const smoothing of [0, 1, 2])
  for (const reach of [0, 3])
    for (const [name, points, cutoff, view] of curves) {
      const runs = [];
      let run = [];
      for (const p of points) {
        if (p.visible) run.push(p);
        else {
          runs.push(run);
          run = [];
        }
      }
      runs.push(run);
      samples.push({
        name: name + '-' + smoothing + '-' + reach,
        points,
        cutoff,
        view,
        smoothing,
        reach,
        expected: runs.flatMap((r) => runWriter(r, cutoff, view, smoothing, reach)),
      });
    }
const result = {
  format: 1,
  scope: 'Pinned external writer, not native execution. Visibility splitting is caller policy.',
  producerSha256: hash(fs.readFileSync(import.meta.filename)),
  reader: { ...pin, executedPath: sourceFile },
  pinFileSha256: hash(fs.readFileSync(pinFile)),
  samples,
};
const output = 'docs/reference/source-packed-trail-samples.json';
const raw = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else fs.writeFileSync(output, raw, { flag: 'wx' });
console.log(
  JSON.stringify({ cases: samples.length, sha256: hash(raw), bytes: Buffer.byteLength(raw) })
);
