/** Independent pinned external legacy shape samples, never application code. */
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
    path: '.cache/baron-emission-readers/engine/utils/sampleCurve.ts',
    sha256: '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/spawnShape.ts',
    sha256: '28a9f0b0a3bd61887564f6b77241317ed2242433691ff45fe2c29ddea392472d',
  },
];
function load(row, resolve) {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  const exports = {};
  new Function(
    'exports',
    'require',
    ts.transpileModule(raw.toString(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(exports, resolve);
  return exports;
}
const basis = load(readers[0], (name) => {
  assert.equal(name, '@/modules/viewport/shared/utils/space');
  return { AXIS_SIGN: [1, 1, 1] };
});
const curve = load(readers[1], () => {
  throw Error('Unexpected external curve dependency');
});
const shape = load(readers[2], (name) => {
  if (name.endsWith('/basis')) return basis;
  if (name.endsWith('/sampleCurve')) return curve;
  throw Error('Unexpected external shape dependency ' + name);
});
const raw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(raw).digest('hex'), programSha256);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const native = JSON.parse(raw).profiles.find((p) => p.role === 'missile' && p.index === 2).shape;
const definitions = [
  {
    name: 'baron-smoke',
    definition: { offset: native.offset, angles: native.angles, axes: native.axes },
  },
];
for (const [name, angles, axes] of [
  ['yaw', [[90]], [[0, 1, 0]]],
  [
    'composed',
    [[35], [-70]],
    [
      [1, 0, 0],
      [0, 1, 0],
    ],
  ],
  ['oblique', [[-120]], [[1, 2, -3]]],
  ['zero-axis', [[45]], [[0, 0, 0]]],
  ['zero-angle', [[0]], [[1, 2, 3]]],
])
  definitions.push({
    name,
    definition: {
      offset: {
        ...constant([10, -20, 30]),
        probabilities: [
          { times: [0, 1], values: [0.25, 1.75], single: 1 },
          { times: [], values: [], single: 1 },
          { times: [0, 1], values: [-1, 1], single: 1 },
        ],
      },
      angles: angles.map(constant),
      axes,
    },
  });
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: d.probabilities.map((p, channel) => ({
    channel,
    single: p.single,
    keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
  })),
});
const samples = [];
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex');
for (const [definition, row] of definitions.entries())
  for (const phase of [0, 0.5, 1.5])
    for (const pinned of [null, 0.75, 1]) {
      const d = row.definition,
        input = {
          kind: 'legacy',
          offset: value(d.offset),
          translation: value(constant([0, 0, 0])),
          angles: d.angles.map(value),
          axes: d.axes,
        };
      const draws = [0.125, 0.375, 0.625, 0.875];
      let consumed = 0;
      const out = shape.birth();
      shape.sampleShape(input, { unitFloat: () => draws[consumed++] }, phase, pinned, out);
      samples.push({
        definition,
        phase,
        pinned,
        draws: draws.slice(0, consumed),
        consumed,
        expected: {
          raw: hex(out.raw),
          offset: hex(out.offset),
          turn: hex(out.turn),
          turned: out.turned,
        },
      });
    }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Current zero-translation legacy shape law; exact external JS float32 outputs and draw counts, no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-legacy-shape-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
