/** Executes selected external settle/finished/clock/linger functions on a local
 * float32 pool. No application helper, particle retirement or native client. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/model/systemModel.ts',
    sha256: '20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/integrate.ts',
    sha256: '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
  },
];
function selected(row, functions, constants, extra = '', dependencies = {}) {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  const source = ts.createSourceFile(row.path, raw.toString(), ts.ScriptTarget.Latest, true),
    parts = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && functions.includes(statement.name?.text))
      parts.push(statement.getText(source));
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (constants.includes(declaration.name.getText(source)))
          parts.push(`const ${declaration.getText(source)};`);
  }
  assert.equal(parts.length, functions.length + constants.length);
  const exports = {};
  new Function(
    'exports',
    'dependencies',
    ts.transpileModule(parts.join('\n') + '\n' + extra, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(exports, dependencies);
  return exports;
}
const clock = selected(
  readers[0],
  ['emissionEnd', 'stopWaitSeconds', 'lingerSeconds', 'curveMaximum'],
  ['LINGER_GRACE', 'NEVER_EXPIRES']
);
const external = selected(
  readers[1],
  ['settle', 'finished'],
  [],
  `const {emissionEnd,stopWaitSeconds,lingerSeconds}=dependencies;
const LINGER_TYPE={maxLifetimeAfterEmitterDies:0,fixedLifetimeAfterEmitterDies:1,fixedLifetimeAfterEmitterStops:2,none:3};
const NOT_LINGERING=-1;export {settle};`,
  clock
);
const base = {
  lifetime: 1,
  particleLifetimeMaximum: 0.75,
  simple: false,
  singleParticle: false,
  overridesMaterials: false,
  delay: 0,
  emitterLinger: 0,
  period: null,
};
const policies = [];
for (const kind of [0, 1, 2, 3])
  for (const [name, window, particleLinger] of [
    ['default', base, 0.2],
    ['wait', { ...base, emitterLinger: 1 }, 0.3],
    ['single', { ...base, singleParticle: true }, 0.5],
    ['override', { ...base, singleParticle: true, overridesMaterials: true }, 0.5],
    ['simple', { ...base, simple: true }, 100],
    ['negative-end', { ...base, lifetime: -1 }, -1],
    ['unbounded', { ...base, lifetime: null, particleLifetimeMaximum: -1 }, 100],
  ])
    policies.push({ name: `${kind}-${name}`, policy: { window, particleLinger, kind } });
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex'),
  samples = [];
for (const [policyIndex, row] of policies.entries())
  for (const age of [0.1, 1, 1.1])
    for (const stopped of [false, true])
      for (const alreadyFinished of [false, true]) {
        const policy = row.policy,
          w = policy.window,
          emitter = {
            ...w,
            particleLinger: policy.particleLinger,
            lingerType: policy.kind,
            particleLifetime: { constant: [w.particleLifetimeMaximum], keys: [] },
          };
        const state = {
          age,
          lastSpawn: 0.1,
          emitted: true,
          finishedAt: alreadyFinished ? 0.05 : null,
        };
        const pool = {
          count: 3,
          emitter: new Uint16Array([0, 0, 0]),
          birthTime: new Float32Array([0, 0.025, 0.05]),
          lifetime: new Float32Array([0.1, 0.75, Infinity]),
          lingerFrom: new Float32Array([-1, -1, alreadyFinished ? 0.05 : -1]),
        };
        const input = {
          state: { ...state },
          now: age,
          stopped,
          birthTime: hex(pool.birthTime),
          lifetime: hex(pool.lifetime),
          lingerFrom: hex(pool.lingerFrom),
        };
        external.settle(pool, emitter, 0, state, { now: age, stopped });
        samples.push({
          policy: policyIndex,
          input,
          expected: {
            finishedAt: state.finishedAt,
            lifetime: hex(pool.lifetime),
            lingerFrom: hex(pool.lingerFrom),
          },
        });
      }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  scope:
    'Selected external settlement modes and float32 lifetime/linger writes; no native ownership/retirement certificate.',
  policies,
  samples,
};
const output = 'docs/reference/source-lifetime-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    policies: policies.length,
    samples: samples.length,
    nativeExecuted: false,
  })
);
