/** Execute the pinned external spin/post-rotation composition without local renderer code. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/simulation/particleRead.ts',
    sha256: '1c2ac421e97d350cc1758785bab1f841fb95064c31ac9b81ebe214447bb811ab',
  },
  {
    path: '.cache/baron-emission-readers/engine/utils/basis.ts',
    sha256: '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  },
  {
    path: '.cache/baron-emission-readers/engine/model/enums.ts',
    sha256: 'fdad53c133ef6c59162131d8b7e1763d8aa29594ba330a65e8372f493d8160fc',
  },
];
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const checked = (row) => {
  const raw = fs.readFileSync(row.path);
  assert.equal(sha(raw), row.sha256);
  return raw.toString();
};
function compile(source, dependencies = {}) {
  const exports = {};
  new Function(
    'exports',
    'require',
    'dependencies',
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(
    exports,
    (name) => {
      assert.equal(name, '@/modules/viewport/shared/utils/space');
      return { AXIS_SIGN: [1, 1, 1] };
    },
    dependencies
  );
  return exports;
}
const basis = compile(checked(readers[1])),
  enums = compile(checked(readers[2]));
const ast = ts.createSourceFile(readers[0].path, checked(readers[0]), ts.ScriptTarget.Latest, true);
const selected = ast.statements.filter(
  (s) => ts.isFunctionDeclaration(s) && ['orbitInto', 'ownBasisInto'].includes(s.name?.text)
);
assert.equal(selected.length, 2);
const external = compile(
  selected.map((s) => s.getText(ast)).join('\n') +
    `
const {standingInto, multiplyInto, alongInto, QUAD_TYPE}=dependencies;
const ORBITED=new Float32Array(3), FACTOR=new Float32Array(9);
const DEGREES_PER_RADIAN=180/Math.PI;
const AIMED=new Set([QUAD_TYPE.arbitrary, QUAD_TYPE.mesh, QUAD_TYPE.attachedMesh]);
`,
  { ...basis, ...enums }
);
const samples = [];
const identity = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
for (const spin of [
  [0, 0, 0],
  [17, -31, 43],
  [-90, 12, 0],
  [0, 0, 90],
  [123.456, -9.87, 0.12],
  [1e-8, 180, -45],
]) {
  for (const postRotate of [
    null,
    [90, 0, 0],
    [0, 90, 0],
    [0, 0, 90],
    [17, -31, 43],
    [-90, 12, 0],
    [123.456, -9.87, 0.12],
  ]) {
    const output = new Float32Array(9);
    external.ownBasisInto(
      {
        rotation: Float32Array.from(spin),
        orbital: new Float32Array(3),
        birthTime: Float32Array.of(0),
        drift: new Float32Array(3),
      },
      0,
      {
        postRotate,
        particleLocalOrientation: false,
        directionOriented: false,
        quadType: enums.QUAD_TYPE.mesh,
      },
      { now: 0, orientation: identity, world: { hud: false, basis: identity } },
      output
    );
    samples.push({ spin, postRotate, expected: Buffer.from(output.buffer).toString('hex') });
  }
}
const record = {
  format: 1,
  scope:
    'Pinned external spin followed by left-multiplied post rotation; all other own-basis factors disabled or identity. No native callback or rendered-pixel claim.',
  readers,
  samples,
};
const output = 'docs/reference/source-particle-post-rotation-samples.json';
const raw = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else {
  assert(!fs.existsSync(output), 'Refuse to overwrite independent source fixtures');
  fs.writeFileSync(output, raw, { flag: 'wx' });
}
console.log(JSON.stringify({ result: 'passed', samples: samples.length }));
