import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { baronRibbon, type BaronRibbonPoint } from '../src/render/baron-ribbon';
const pins: Record<string, string> = {
  'rendering/utils/ribbon.ts': 'ada3d66b955dee7916f10e5b76417a9d7985bbbca337afcd551a7f30fa5cbe68',
  'engine/utils/basis.ts': '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  'engine/utils/sampleCurve.ts': '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  'engine/model/enums.ts': 'fdad53c133ef6c59162131d8b7e1763d8aa29594ba330a65e8372f493d8160fc',
};
const cache = new Map();
function load(file: string): any {
  if (cache.has(file)) return cache.get(file);
  const raw = readFileSync('.cache/baron-emission-readers/' + file);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(pins[file]);
  const exports = {};
  cache.set(file, exports);
  vm.runInNewContext(
    ts.transpileModule(raw.toString(), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
      .outputText,
    {
      exports,
      require: (name: string) => {
        if (name === 'three') return THREE;
        if (name === '@/modules/viewport/shared/utils/space') return { AXIS_SIGN: [1, 1, 1] };
        if (name === '@/modules/viewport') return { AXIS_SIGN: [1, 1, 1] };
        if (name === './buffers')
          return {
            written: () => {
              throw Error('Unexpected geometry upload');
            },
          };
        return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) + '.ts');
      },
    }
  );
  return exports;
}
const external = load('rendering/utils/ribbon.ts');
const bytes = (values: Float32Array | Uint32Array) =>
  Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('hex');
const uv = (p: BaronRibbonPoint) => [
  p.uv.turn,
  p.uv.scaleU,
  p.uv.scaleV,
  p.uv.offsetU,
  p.uv.offsetV,
  p.uv.cellU,
  p.uv.cellV,
];
for (let variant = 0; variant < 48; variant++)
  test(`WAKE/OFF ribbon matches external writer ${variant}`, () => {
    const count = variant % 12,
      points: BaronRibbonPoint[] = Array.from({ length: count }, (_, i) => ({
        position: variant % 8 === 0 ? [5, 5, 5] : [i * 11.13, Math.sin(i) * 7, i * i * 0.31],
        side: [Math.cos(i), 0, Math.sin(i)],
        halfWidth: 2 + i * 0.3,
        tiling: [variant % 3 === 0 ? 0 : 100, variant % 3 === 0 ? -2 : variant % 3 === 1 ? 0 : 20],
        odometer: 500 + i * 33.13,
        uv: {
          turn: 0.03 * i,
          scaleU: 1 + i * 0.1,
          scaleV: 0.7,
          offsetU: -i * 0.1,
          offsetV: i * 0.03,
          cellU: 0,
          cellV: 0,
        },
      }));
    const view =
        variant % 4 === 0
          ? null
          : variant % 4 === 1
            ? [0, 0, 1]
            : variant % 4 === 2
              ? [0, 1, 0]
              : [0.2, -0.3, -0.9],
      cutoff = variant % 5 === 0 ? 25 : 3000;
    const held = external.strand(count);
    held.count = count;
    for (const [i, p] of points.entries()) {
      held.position.set(p.position, i * 3);
      held.side.set(p.side, i * 3);
      held.width[i] = p.halfWidth;
      held.tiling.set(p.tiling, i * 2);
      held.odometer[i] = p.odometer;
      held.uv.set(uv(p), i * 7);
    }
    const out: any = {};
    for (const [key, width] of Object.entries({
      position: 3,
      uv: 2,
      alphaUv: 2,
      cell: 2,
      tint: 4,
      lookup: 2,
      erode: 1,
      multUv: 2,
      multCell: 2,
    }))
      out[key] = new Float32Array(count * 2 * width);
    out.index = new Uint32Array(Math.max(0, count - 1) * 6);
    out.edges = new Uint32Array(out.index.length * 2);
    const cursor = { vertex: 0, index: 0 };
    external.writeTrail(
      held,
      {
        view,
        wake: true,
        smoothing: 0,
        reach: 3,
        cutoff,
        layers: { base: { center: [0.5, 0.5], flipU: false, flipV: false }, mult: null },
      },
      out,
      cursor
    );
    // The native pool stores all input streams as float32 before the writer reads them.
    const rounded = points.map((p, i) => ({
      ...p,
      position: held.position.subarray(i * 3, i * 3 + 3),
      side: held.side.subarray(i * 3, i * 3 + 3),
      halfWidth: held.width[i],
      tiling: held.tiling.subarray(i * 2, i * 2 + 2),
      odometer: held.odometer[i],
    }));
    const actual = baronRibbon(rounded, cutoff, view);
    expect(actual).toHaveLength(cursor.index);
    const expand = (field: string, width: number) =>
      Float32Array.from(
        Array.from((out.index as Uint32Array).subarray(0, cursor.index)).flatMap((index: number) =>
          Array.from(out[field].subarray(index * width, index * width + width))
        )
      );
    expect(bytes(Float32Array.from(actual.flatMap((v) => Array.from(v.position))))).toBe(
      bytes(expand('position', 3))
    );
    expect(bytes(Float32Array.from(actual.flatMap((v) => Array.from(v.uv))))).toBe(
      bytes(expand('uv', 2))
    );
  });
test('invalid ribbon inputs reject', () => {
  expect(() => baronRibbon([], NaN, null)).toThrow();
  expect(() => baronRibbon([], 0, [0, 0, 0])).toThrow();
});
