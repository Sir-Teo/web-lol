/** Golden static-mesh births from the pinned external reader, not this project's sampler. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import ts from 'typescript';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = '.cache/baron-emission-readers/rendering/utils/emissionSurface.ts';
const bytes = fs.readFileSync(path);
const digest = '880e6df1f4d06ae6a74198059d45ef2de15b87d4a1c44e898fbf9b7bc602effe';
assert.equal(hash(bytes), digest);
const exported = {};
new Function(
  'require',
  'exports',
  ts.transpileModule(bytes.toString(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)((name) => (name === 'three' ? THREE : {}), exported);
const decoded = fs.readFileSync('docs/reference/baron-attack-decoded.json');
assert.equal(hash(decoded), 'ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20');
const source = JSON.parse(decoded).meshes.find(
  (row) => row.source.wadPathHash === '80975d7a4f06e4d6'
);
const native = fs.readFileSync('.cache/baron-attack-decoded/' + source.path);
assert.equal(native.length, source.bytes);
assert.equal(hash(native), source.sha256);
const mesh = JSON.parse(native);
const meshes = {
  unequal: {
    positions: [0, 0, 0, 2, 0, 0, 0, 2, 0, 10, 0, 0, 14, 0, 0, 10, 4, 0],
    indices: [0, 1, 2, 3, 4, 5],
  },
  noArea: { positions: [0, 0, 0, 1, 0, 0, 2, 0, 0], indices: [0, 1, 2] },
  small: { positions: [0, 0, 0, 0.001, 0, 0, 0, 0.001, 0], indices: [0, 1, 2] },
  sphere: { positions: mesh.sourcePoints.flat(), indices: mesh.sourceIndices },
};
const cases = [
  ['first-corner', 'unequal', [0, 0, 0]],
  ['third-corner-concentration', 'unequal', [0.1, 0.5, 0.5]],
  ['area-below-boundary', 'unequal', [0.199999, 0.25, 0.75]],
  ['area-at-boundary', 'unequal', [0.2, 0.25, 0.75]],
  ['last-face', 'unequal', [0.999999, 0.75, 0.25]],
  ['degenerate', 'noArea', []],
  ['below-minimum-area', 'small', []],
  ...Array.from({ length: 64 }, (_, i) => [
    `source-sphere-${i}`,
    'sphere',
    [i / 64, ((i * 17) % 64) / 64, ((i * 29) % 64) / 64],
  ]),
];
const samplers = new Map(
  Object.entries(meshes).map(([key, m]) => [
    key,
    exported.staticMeshSurface({
      positions: Float32Array.from(m.positions),
      indices: Uint32Array.from(m.indices),
    }),
  ])
);
const samples = cases.map(([name, key, draws]) => {
  let count = 0;
  const out = { position: new Float32Array(3), normal: new Float32Array(3) };
  const sampled = samplers.get(key).sample(
    0,
    {
      unitFloat() {
        assert(count < draws.length, 'Unexpected external random draw');
        return draws[count++];
      },
    },
    out
  );
  assert.equal(count, draws.length);
  return {
    name,
    mesh: key,
    draws,
    sampled,
    position: Array.from(out.position),
    normal: Array.from(out.normal),
  };
});
const result = {
  reader: { path, sha256: digest, revision: '2adda384347dd43e76d6295d77fe1f13623b2808' },
  source: source.source,
  decodedMeshSha256: source.sha256,
  meshes,
  samples,
  scope:
    'External reconstruction in original source units. No native CPU, PRNG, attachment, renderer or scheduling certification.',
};
const output = 'docs/reference/static-emission-samples.json',
  raw = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else fs.writeFileSync(output, raw, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
