/** Independent selected external complex birth-value writes; excludes shape,
 * placement, flex and UV, and never imports the application birth helper. */
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
    path: '.cache/baron-emission-readers/engine/simulation/emit.ts',
    sha256: '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58',
  },
];
function checked(row) {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw.toString();
}
const curve = {};
new Function(
  'exports',
  ts.transpileModule(checked(readers[0]), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(curve);
const source = ts.createSourceFile(
  readers[1].path,
  checked(readers[1]),
  ts.ScriptTarget.Latest,
  true
);
const selected = source.statements.filter(
  (s) => ts.isFunctionDeclaration(s) && s.name?.text === 'drawnLifetime'
);
assert.equal(selected.length, 1);
const life = {};
new Function(
  'exports',
  'dependencies',
  ts.transpileModule(
    selected[0].getText(source) +
      '\nconst {sampleCurve,tableValue}=dependencies; const scalar=v=>v[0]??0; export {drawnLifetime};',
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }
  ).outputText
)(life, curve);
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json');
const programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const fields = {
  lifetime: ['particleLifetime', [3]],
  velocity: ['birthVelocity', [0, 0, 0]],
  rotation: ['birthRotation0', [0, 0, 0]],
  angularVelocity: ['birthRotationalVelocity0', [0, 0, 0]],
  scale: ['birthScale0', [1, 1, 1]],
  drag: ['birthDrag', [0, 0, 0]],
  color: ['birthColor', [1, 1, 1, 1]],
};
const definitions = JSON.parse(programRaw).profiles.map((p) => ({
  name: `${p.role}-${p.index}-${p.name}`,
  definition: Object.fromEntries(
    Object.entries(fields).map(([key, [field, fallback]]) => [
      key,
      p.curves[field] ?? constant(fallback),
    ])
  ),
}));
definitions.push({
  name: 'negative-life',
  definition: { ...definitions[0].definition, lifetime: constant([-1]) },
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
const hex = (array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
const samples = [];
for (const [definition, row] of definitions.entries())
  for (const phase of [0, 0.5, 1.25])
    for (const pinned of [null, 0.75, 1]) {
      const curves = Object.fromEntries(
        Object.entries(row.definition).map(([key, d]) => [key, value(d)])
      );
      let consumed = 0;
      const draws = Array.from({ length: 32 }, (_, i) => ((i * 7 + 3) % 32) / 32),
        draw = () => draws[consumed++];
      const lifetime = new Float32Array([
        life.drawnLifetime(
          { particleLifetime: curves.lifetime },
          phase,
          { unitFloat: draw },
          pinned
        ),
      ]);
      const expected = { lifetime: hex(lifetime) };
      for (const key of ['velocity', 'rotation', 'angularVelocity', 'scale', 'drag', 'color']) {
        const out = new Float32Array(row.definition[key].constant.length);
        curve.drawChannelsInto(curves[key], phase, draw, pinned, out, 0);
        expected[key] = hex(out);
      }
      samples.push({
        definition,
        phase,
        pinned,
        draws: draws.slice(0, consumed),
        consumed,
        expected,
      });
    }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Selected external complex birth values for current Baron closure; shape/surface/flex/shared-chance/UV excluded; no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-birth-value-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
