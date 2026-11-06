/** Independent execution of the pinned external 64-entry integral baker. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const path = '.cache/baron-emission-readers/engine/utils/sampleCurve.ts';
const raw = fs.readFileSync(path),
  sha256 = '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230';
assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(raw.toString(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(exports);
const definitions = [];
for (const [name, times, values, keyed] of [
  ['constant', [0], [[3, -2, 0.5]], false],
  ['one-key', [0], [[3, -2, 0.5]], true],
  [
    'ramp',
    [0, 1],
    [
      [0, 1, -1],
      [2, 3, 1],
    ],
    true,
  ],
  [
    'flat-ends',
    [0.25, 0.75],
    [
      [2, 3, 4],
      [4, 2, 1],
    ],
    true,
  ],
  [
    'negative-start',
    [-0.5, 0.5, 1.5],
    [
      [2, -1, 3],
      [4, 1, 2],
      [1, 3, 4],
    ],
    true,
  ],
  [
    'duplicate',
    [0, 0.5, 0.5, 1],
    [
      [1, 2, 3],
      [3, 4, 5],
      [2, 0, -1],
      [4, 3, 2],
    ],
    true,
  ],
  ['signed-zero', [0], [[-0, 0, -0]], true],
])
  definitions.push({
    name,
    value: {
      constant: [...values[0]],
      times,
      values,
      authoredKeyCount: keyed ? times.length : 0,
      probabilities: [],
      sourceType: 'IntegratedValueVector3',
    },
  });
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json');
const programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
definitions.push({
  name: 'baron-hit-embers-add',
  value: JSON.parse(programRaw).profiles.find((p) => p.role === 'hit' && p.index === 4).curves
    .worldAcceleration,
});
const doubleHex = (values) => Buffer.from(new Float64Array(values).buffer).toString('hex');
for (const row of definitions)
  row.inputHex = {
    constant: doubleHex(row.value.constant),
    values: row.value.values.map(doubleHex),
  };
const samples = [];
for (const [definition, row] of definitions.entries()) {
  const d = row.value,
    curve = {
      constant: d.constant,
      keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
      tables: [],
    };
  for (const age01 of [-0.1, 0, 1 / 63, 0.1, 0.5, 0.50001, 0.9, 1, 1.1])
    for (const order of [1, 2]) {
      const out = new Float32Array(d.constant.length);
      exports.integratedInto(curve, age01, order, out, 0);
      samples.push({
        definition,
        age01,
        order,
        expectedHex: Buffer.from(out.buffer).toString('hex'),
      });
    }
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader: { path, sha256 },
  programSha256,
  scope:
    'External integral table samples only; lifetime scaling, probability and native scheduling are caller responsibilities.',
  definitions,
  samples,
};
const output = 'docs/reference/source-integrated-value-samples.json',
  text = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
