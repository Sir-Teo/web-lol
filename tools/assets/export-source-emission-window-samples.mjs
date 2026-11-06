/** Independent selected external emitter-clock fixtures; no application import. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const path = '.cache/baron-emission-readers/engine/model/systemModel.ts';
const raw = fs.readFileSync(path),
  sha256 = '20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad';
assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
const source = ts.createSourceFile(path, raw.toString(), ts.ScriptTarget.Latest, true);
const functions = [
  'emissionEnd',
  'emissionEnded',
  'stopWaitSeconds',
  'periodActive',
  'emitterPhase',
  'curveMaximum',
];
const constants = ['LINGER_GRACE', 'NEVER_EXPIRES', 'LEAST_PHASE_SPAN'];
const selected = [];
for (const statement of source.statements) {
  if (ts.isFunctionDeclaration(statement) && functions.includes(statement.name?.text))
    selected.push(statement.getText(source));
  if (ts.isVariableStatement(statement))
    for (const declaration of statement.declarationList.declarations)
      if (constants.includes(declaration.name.getText(source)))
        selected.push(`const ${declaration.getText(source)};`);
}
assert.equal(selected.length, functions.length + constants.length);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(selected.join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(exports);
const base = {
  lifetime: 1,
  particleLifetimeMaximum: 0.5,
  simple: false,
  singleParticle: false,
  overridesMaterials: false,
  delay: 0,
  emitterLinger: 0,
  period: null,
};
const cases = [
  base,
  ...[
    { lifetime: null },
    { lifetime: -1 },
    { lifetime: 0 },
    { lifetime: 1e-6 },
    { lifetime: 1e-7 },
    { singleParticle: true, lifetime: null },
    { singleParticle: true, lifetime: 10.5 },
    { singleParticle: true, lifetime: 10.5001 },
    { singleParticle: true, lifetime: null, particleLifetimeMaximum: -1 },
    { singleParticle: true, lifetime: 20, overridesMaterials: true },
    { singleParticle: true, lifetime: 20, simple: true },
    { delay: 0.15, lifetime: 0.5 },
    { emitterLinger: 100 },
    { emitterLinger: -1 },
    { period: { length: 1.5, active: 1.5 } },
    { period: { length: 0, active: 1 } },
    { period: { length: null, active: 1 } },
    { period: { length: 1, active: 0.25 }, delay: 0.1 },
    { period: { length: 1, active: null } },
    { lifetime: null, period: { length: 1, active: 0.25 } },
  ].map((p) => ({ ...base, ...p })),
];
const samples = [];
for (const [index, profile] of cases.entries())
  for (const age of [0, 0.1, 0.15, 0.25, 0.5, 1, 1.5, 2]) {
    const emitter = {
      ...profile,
      timeBeforeFirstEmission: profile.delay,
      particleLifetime: { constant: [profile.particleLifetimeMaximum], keys: [] },
    };
    const end = exports.emissionEnd(emitter);
    const phase = exports.emitterPhase(emitter, age);
    const encoded = Buffer.alloc(8);
    encoded.writeDoubleLE(phase);
    samples.push({
      name: `${index}-${age}`,
      profile,
      age,
      phaseHex: encoded.toString('hex'),
      expected: {
        end,
        phase,
        waiting: age < profile.delay,
        ended: exports.emissionEnded(emitter, age),
        active: exports.periodActive(profile.period, age),
        stopWait: exports.stopWaitSeconds(emitter),
      },
    });
  }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader: { path, sha256 },
  scope:
    'External emitter clock functions with resolved constant lifetime maximum; no native scheduling or ownership certificate.',
  samples,
};
const output = 'docs/reference/source-emission-window-samples.json',
  text = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
