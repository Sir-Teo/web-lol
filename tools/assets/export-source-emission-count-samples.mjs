/** Execute the pinned external count functions with a supplied resolved rate.
 * Rate curves, random draws, flex, clocks and birth writes are outside scope. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const path = '.cache/baron-emission-readers/engine/simulation/emit.ts';
const raw = fs.readFileSync(path);
const sha256 = '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58';
assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
const source = ts.createSourceFile(path, raw.toString(), ts.ScriptTarget.Latest, true);
const functions = ['spawnCount', 'segmentsLeft', 'burstCap', 'capped'];
const constants = ['BURST_SHARE', 'MOST_PER_STEP', 'COUNT_MASK'];
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
const code = `${selected.join('\n')}\nconst QUAD_TYPE={cameraSegmentBeam:9};
function rateOf(emitter){return emitter.resolvedRate;}
export {spawnCount};`;
const exports = {};
new Function(
  'exports',
  ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(exports);
const samples = [];
for (const rate of [0, 0.1, 1, 30, 50, 200, 70000, 65536, 198593])
  for (const policy of [
    'first',
    'later',
    'variable',
    'single',
    'trail',
    'segment',
    'cycle',
    'long-gap',
  ]) {
    const input = {
      rate,
      age: policy === 'long-gap' ? 10 : 1 / 60,
      lastSpawn: 0,
      emitted: policy === 'later',
      singleParticle: policy === 'single',
      variableStart: policy === 'variable',
      periodLength: policy === 'cycle' ? 1 / 100 : null,
      maxPerFrame: policy === 'trail' ? 3 : 0,
      segmentLimit: policy === 'segment' ? 4 : null,
      spawned: policy === 'segment' ? 3 : 0,
    };
    const emitter = {
      resolvedRate: rate,
      period: input.periodLength === null ? null : { length: input.periodLength },
      hasVariableStartTime: input.variableStart,
      singleParticle: input.singleParticle,
      trail: { maxAddedPerFrame: input.maxPerFrame },
      quadType: input.segmentLimit === null ? 0 : 9,
      beam: { segments: input.segmentLimit ?? 0 },
    };
    const state = {
      age: input.age,
      lastSpawn: input.lastSpawn,
      emitted: input.emitted,
      spawned: input.spawned,
    };
    samples.push({
      name: `${rate}-${policy}`,
      input,
      expected: exports.spawnCount(emitter, state, {}, 0, {}, new Float32Array()),
    });
  }
const sequences = [15, 50, 200].map((rate) => {
  const emitter = {
    resolvedRate: rate,
    period: null,
    hasVariableStartTime: false,
    singleParticle: false,
    trail: null,
    quadType: 0,
  };
  const state = { age: 0, lastSpawn: 0, emitted: false, spawned: 0 };
  const counts = [];
  for (let tick = 1; tick <= 60; tick++) {
    state.age = tick / 60;
    const count = exports.spawnCount(emitter, state, {}, 0, {}, new Float32Array());
    counts.push(count);
    if (count > 0) {
      state.lastSpawn = state.age;
      state.emitted = true;
      state.spawned += count;
    }
  }
  return { rate, counts };
});
const record = {
  sequences,
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader: { path, sha256 },
  scope:
    'Selected external count functions, supplied resolved rate; no native engine or scheduling certificate.',
  samples,
};
const output = 'docs/reference/source-emission-count-samples.json';
const text = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
