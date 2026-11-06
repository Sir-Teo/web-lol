/** Executes the pinned external value kernels; application helper is not imported. */
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
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json');
const programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const program = JSON.parse(programRaw);
const definitions = [];
for (const [role, index, field] of [
  ['missile', 0, 'particleLifetime'],
  ['missile', 0, 'uvRotation'],
  ['missile', 0, 'birthScale0'],
  ['missile', 0, 'Color'],
  ['missile', 2, 'birthUVOffset'],
  ['hit', 7, 'particleLifetime'],
  ['hit', 9, 'birthRotation0'],
  ['hit', 4, 'birthVelocity'],
]) {
  const profile = program.profiles.find((p) => p.role === role && p.index === index);
  definitions.push({ name: `${role}-${index}-${field}`, value: profile.curves[field] });
}
definitions.push({
  name: 'duplicate-keys-and-tables',
  value: {
    constant: [999],
    times: [0, 0.5, 0.5, 1],
    values: [[0], [1], [3], [7]],
    authoredKeyCount: 4,
    probabilities: [{ times: [0, 0.5, 0.5, 1], values: [1, 2, 4, 8], single: 1 }],
  },
});
definitions.push({
  name: 'flat-ends',
  value: {
    constant: [999],
    times: [0.25, 0.75],
    values: [[2], [6]],
    authoredKeyCount: 2,
    probabilities: [{ times: [0.25, 0.75], values: [0.25, 1.75], single: 1 }],
  },
});
definitions.push({
  name: 'round-before-multiply',
  value: {
    constant: [1 / 3, Math.PI, 1e-8],
    times: [0],
    values: [[1 / 3, Math.PI, 1e-8]],
    authoredKeyCount: 0,
    probabilities: [
      { times: [], values: [], single: 1 / 7 },
      { times: [], values: [], single: 1 / 3 },
      { times: [], values: [], single: Math.PI },
    ],
  },
});
const hex = (array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
const samples = [];
for (const [definition, row] of definitions.entries())
  for (const phase of [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.5])
    for (const pinned of [null, 0.75, 1]) {
      const d = row.value,
        curve = {
          constant: d.constant,
          keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
          tables: d.probabilities.map((p, channel) => ({
            channel,
            single: p.single,
            keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
          })),
        };
      const draws = [0.125, 0.375, 0.625, 0.875];
      let consumed = 0;
      const channel = new Float32Array(d.constant.length);
      exports.drawChannelsInto(curve, phase, () => draws[consumed++], pinned, channel, 0);
      const shared = exports.drawCurve(curve, phase, 0.25);
      const ordinary = exports.sampleCurve(curve, phase);
      samples.push({
        definition,
        phase,
        pinned,
        draws: draws.slice(0, consumed),
        consumed,
        expected: {
          sampleHex: hex(new Float64Array(ordinary)),
          sharedHex: hex(new Float64Array(shared)),
          channelsHex: hex(channel),
        },
      });
    }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader: { path, sha256 },
  programSha256,
  scope:
    'External value kernels and draw counts from supplied normalized values; no native PRNG/curve parsing/scheduling certificate.',
  definitions,
  samples,
};
const output = 'docs/reference/source-value-samples.json',
  text = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
