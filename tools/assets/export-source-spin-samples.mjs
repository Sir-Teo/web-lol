/** Independent selected external turn and drawing-basis functions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/utils/sampleCurve.ts',
    sha256: '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/integrate.ts',
    sha256: '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
  },
  {
    path: '.cache/baron-emission-readers/engine/utils/basis.ts',
    sha256: '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  },
];
const checked = (row) => {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw.toString();
};
const compile = (text, dependencies = {}) => {
  const exports = {};
  new Function(
    'exports',
    'require',
    'dependencies',
    ts.transpileModule(text, {
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
};
const curve = compile(checked(readers[0])),
  basis = compile(checked(readers[2]));
const source = ts.createSourceFile(
    readers[1].path,
    checked(readers[1]),
    ts.ScriptTarget.Latest,
    true
  ),
  selected = source.statements.filter(
    (s) => ts.isFunctionDeclaration(s) && s.name?.text === 'turn'
  );
assert.equal(selected.length, 1);
const external = compile(
  selected[0].getText(source) +
    `\nconst {sampleCurveInto,integratedInto}=dependencies;
const ROTATION_RATE=60,NOT_LINGERING=-1,OVER_LIFE=new Float32Array(3);
function sampleScalar(){throw Error('Legacy simple spin is outside this fixture');}export {turn};`,
  curve
);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const definitions = JSON.parse(programRaw).profiles.map((p) => ({
  name: `${p.role}-${p.index}-${p.name}`,
  definition: { enabled: !!p.settings.isRotationEnabled, rotation: constant([0, 0, 0]) },
}));
for (const [name, rotation, lingerRotation] of [
  ['constant', constant([1, 2, 3]), null],
  [
    'keyed',
    {
      ...constant([0, 0, 0]),
      times: [0, 1],
      values: [
        [0, 1, -1],
        [2, 3, 1],
      ],
      authoredKeyCount: 2,
    },
    null,
  ],
  [
    'linger',
    {
      ...constant([0, 0, 0]),
      times: [0, 1],
      values: [
        [0, 1, -1],
        [2, 3, 1],
      ],
      authoredKeyCount: 2,
    },
    {
      ...constant([0, 0, 0]),
      times: [0, 1],
      values: [
        [1, 3, 5],
        [2, -3, 1],
      ],
      authoredKeyCount: 2,
    },
  ],
])
  definitions.push({
    name,
    definition: { enabled: true, rotation, ...(lingerRotation ? { lingerRotation } : {}) },
  });
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: [],
});
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex'),
  samples = [];
for (const [definition, row] of definitions.entries())
  for (const age of [0, 0.125, 0.5, 1.25])
    for (const life of [0.75, null])
      for (const lingering of [false, true]) {
        const input = {
          birthRotation: [10, -20, 35],
          angularVelocity: [15, -25, 50],
          angularAcceleration: [1, -2, 3],
          age,
          life,
          lingering,
        };
        const pool = {
          birthRotation: new Float32Array(input.birthRotation),
          angularVelocity: new Float32Array(input.angularVelocity),
          angularAcceleration: new Float32Array(input.angularAcceleration),
          rotation: new Float32Array(3),
          lifetime: new Float32Array([life ?? Infinity]),
          lingerFrom: new Float32Array([lingering ? 0 : -1]),
        };
        const emitter = {
          rotationEnabled: row.definition.enabled,
          rotation0: value(row.definition.rotation),
          legacySimple: null,
          linger: row.definition.lingerRotation
            ? { rotation: value(row.definition.lingerRotation) }
            : null,
        };
        const phase = life === null ? 0 : Math.min(Math.max(age / life, 0), 1);
        external.turn(pool, 0, emitter, age, phase);
        const normal = new Float32Array(9),
          rolled = new Float32Array(9);
        basis.standingInto(pool.rotation, 0, 0, normal);
        basis.standingInto(pool.rotation, 0, 17, rolled);
        samples.push({
          definition,
          input,
          expected: { rotation: hex(pool.rotation), basis: hex(normal), rolledBasis: hex(rolled) },
        });
      }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Selected external complex spin and Ry*Rx*Rz basis; supplied birth vectors/clocks, no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-spin-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
