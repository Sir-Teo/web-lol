/** Execute selected independent orbital-basis and velocity-stretch readers. */
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
  (s) => ts.isFunctionDeclaration(s) && ['orbitInto', 'stretchOf'].includes(s.name?.text)
);
assert.equal(selected.length, 2);
const external = compile(
  selected.map((s) => s.getText(ast)).join('\n') +
    `
const {standingInto, QUAD_TYPE}=dependencies;
const ORBITED=new Float32Array(3), DEGREES_PER_RADIAN=180/Math.PI;
`,
  { ...basis, ...enums }
);
const hex = (array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
const orbits = [];
for (const velocity of [
  [0, 0, 0],
  [0, 1.5, 0],
  [0, -1.5, 0],
  [1.2, 0, 0],
  [0, 0, -0.75],
  [0.3, -1.5, 2.25],
  [-1e-10, 1e-9, 0],
  [123.456, -9.87, 0.12],
]) {
  for (const age of [-1e-8, 0, 1 / 120, 1 / 60, 0.17, 0.65, 1.3]) {
    const output = new Float32Array(9);
    const enabled = external.orbitInto({ orbital: Float32Array.from(velocity) }, 0, age, output);
    orbits.push({ velocity, age, expected: enabled ? hex(output) : null });
  }
}
const kinds = {
  billboard: 0,
  quad: 1,
  ray: 2,
  mesh: 3,
  trail: 4,
  beam: 6,
  projection: 7,
  'unit-billboard': 8,
  'segment-beam': 9,
  skin: 11,
};
const stretches = [];
for (const [geometry, quadType] of Object.entries(kinds)) {
  for (const [travel, scale, minimum, simple] of [
    [[0, 0, 0], 0, 1.3, false],
    [[0, 0, 0], Math.fround(0.004), Math.fround(1.3), false],
    [[50, 0, 0], Math.fround(0.004), Math.fround(1.3), false],
    [[300, 400, 0], Math.fround(0.004), Math.fround(1.3), false],
    [[0, -1000, 0], Math.fround(0.004), Math.fround(1.3), false],
    [[0, 0, 0], 0.1, 0, false],
    [[10.3, -17.6, 29.1], 0.03, 0.5, false],
    [[0, 1000, 0], -0.01, 0.5, false],
    [[1000, 0, 0], 0.004, 1.3, true],
  ]) {
    const expected = external.stretchOf({ travel: Float32Array.from(travel) }, 0, {
      quadType,
      directionVelocityScale: scale,
      directionVelocityMinScale: minimum,
      legacySimple: simple ? {} : null,
    });
    stretches.push({ geometry, travel, scale, minimum, simple, expected });
  }
}
const record = {
  format: 1,
  producerSha256: sha(fs.readFileSync(import.meta.filename)),
  readers,
  runtime: { node: process.version, v8: process.versions.v8 },
  orbits,
  stretches,
  limits: [
    'Selected external functions executed without importing application arithmetic.',
    'Orbital angles round to float32 degrees before the standing basis; velocity stretch remains double.',
    'Geometry routing and local effect clocks remain separate from these reader functions.',
  ],
};
const output = 'docs/reference/source-particle-draw-samples.json';
const raw = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else {
  assert(!fs.existsSync(output), 'Refuse to overwrite independent source fixtures');
  fs.writeFileSync(output, raw, { flag: 'wx' });
}
console.log(
  JSON.stringify({ result: 'passed', orbits: orbits.length, stretches: stretches.length })
);
