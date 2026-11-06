/** Selected external normal/turn functions joined by the emit placement writes.
 * Uses previously verified external shape/surface fixtures, never app helpers. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/utils/basis.ts',
    sha256: '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/emit.ts',
    sha256: '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58',
  },
];
const fixtures = [
  {
    path: 'docs/reference/static-emission-samples.json',
    sha256: 'b8f27a9dafa780430270525a1dcc48b5cbdf7a52119678cabbbc18268907b503',
  },
  {
    path: 'docs/reference/source-spawn-shape-samples.json',
    sha256: 'fc7743c9d60f634cfbb48dbbfff4e66c473ed2816f367bd26de59344ab5679d9',
  },
  {
    path: 'docs/reference/source-legacy-shape-samples.json',
    sha256: '5c5a2f53e5555c6657d38a85ed9e3a1b49abb62b4ec65c273c36d990ffcf8578',
  },
];
function checked(row) {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw;
}
const basis = {};
new Function(
  'exports',
  'require',
  ts.transpileModule(checked(readers[0]).toString(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(basis, (name) => {
  assert.equal(name, '@/modules/viewport/shared/utils/space');
  return { AXIS_SIGN: [1, 1, 1] };
});
const code = ts.createSourceFile(
  readers[1].path,
  checked(readers[1]).toString(),
  ts.ScriptTarget.Latest,
  true
);
const selected = code.statements.filter(
  (s) => ts.isFunctionDeclaration(s) && s.name?.text === 'alongNormal'
);
assert.equal(selected.length, 1);
const normal = {},
  surfaceBirth = { normal: new Float32Array(3) };
new Function(
  'exports',
  'SURFACE_BIRTH',
  ts.transpileModule(selected[0].getText(code) + '\nexport {alongNormal};', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(normal, surfaceBirth);
const [surfaces, shapes, legacy] = fixtures.map((row) => JSON.parse(checked(row)));
const decode = (text) => {
  const bytes = Buffer.from(text, 'hex');
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readFloatLE(i * 4));
};
const hex = (value) =>
  Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex');
const chosen = [shapes.samples[0].expected, shapes.samples[9].expected, legacy.samples[9].expected];
const samples = [];
const allSurfaces = [
  null,
  ...surfaces.samples.filter((row) => row.mesh === 'sphere').filter((_, i) => i % 4 === 0),
];
for (const [surfaceIndex, surface] of allSurfaces.entries())
  for (const [shapeIndex, shape] of chosen.entries())
    for (const useNormal of [false, true])
      for (const offsetScale of [1, 0.5]) {
        const base = new Float32Array([3.33, -7.1, 12.6]),
          offset = decode(shape.offset),
          turn = decode(shape.turn),
          velocity = new Float32Array([120, -60, 10]),
          acceleration = new Float32Array([-1, 2, 3]);
        const input = {
          base: hex(base),
          offset: hex(offset),
          turn: hex(turn),
          turned: shape.turned,
          velocity: hex(velocity),
          acceleration: hex(acceleration),
          surface: surface
            ? {
                position: hex(new Float32Array(surface.position)),
                normal: hex(new Float32Array(surface.normal)),
              }
            : null,
          surfaceScale: 0.30000001192092896,
          useNormal,
          offsetScale,
        };
        for (let axis = 0; axis < 3; axis++) offset[axis] *= offsetScale;
        if (surface) {
          const position = new Float32Array(surface.position);
          surfaceBirth.normal.set(surface.normal);
          for (let axis = 0; axis < 3; axis++) base[axis] += position[axis] * input.surfaceScale;
          if (useNormal) {
            normal.alongNormal(velocity, 0);
            normal.alongNormal(acceleration, 0);
          }
        }
        if (shape.turned) {
          basis.turnInto(turn, velocity, 0);
          basis.turnInto(turn, acceleration, 0);
        }
        const position = new Float32Array(3);
        for (let axis = 0; axis < 3; axis++) position[axis] = base[axis] + offset[axis];
        samples.push({
          name: `${surfaceIndex}-${shapeIndex}-${useNormal}-${offsetScale}`,
          input,
          expected: {
            position: hex(position),
            velocity: hex(velocity),
            acceleration: hex(acceleration),
            offset: hex(offset),
          },
        });
      }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  fixtures,
  scope:
    'Selected external normal/turn functions plus emit placement writes; supplied shape/surface samples and scale factors, no actor-size or native certificate.',
  samples,
};
const output = 'docs/reference/source-birth-placement-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
