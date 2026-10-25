/** Offline verification only: never compiles or submits Metal work. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isAbsolute, relative } from 'node:path';

const args = process.argv.slice(2),
  pinArg = args.indexOf('--pin');
const pin = JSON.parse(
  readFileSync(pinArg < 0 ? 'docs/reference/leona/metal-rim-verification.json' : args[pinArg + 1])
);
const historical = args.includes('--historical');
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rows = pin.files;
const byFile = new Map();
for (const r of rows) {
  assert(!byFile.has(r.file), r.file);
  assert.equal(readFileSync(r.archived).length, r.bytes, r.archived);
  assert.equal(sha(r.archived), r.sha256, r.archived);
  if (!historical && r.current) assert.equal(sha(r.file), r.sha256, r.file);
  byFile.set(r.file, r);
}
const frozen = (file) => {
  if (isAbsolute(file)) file = relative(process.cwd(), file);
  assert(byFile.has(file), file);
  return byFile.get(file).archived;
};
const json = (file) => JSON.parse(readFileSync(frozen(file)));
const { expectedMetalRim } = await import(pathToFileURL(frozen('tools/qa/metal-rim-cases.mjs')));
const path = (name) => `${pin.run}/${name}`;
const cases = json(path('cases.json')),
  native = json(path('native.json')),
  webgl = json(path('webgl.json'));
const comparison = json(path('comparison.json')),
  inputs = json(path('inputs.json'));
assert.equal(pin.nativeGameExecuted, false);
assert.equal(pin.nativeShaderExecuted, true);
assert.equal(pin.nativeGameplayFrameVerified, false);
assert.equal(cases.length, 150);
if (!historical) {
  const { metalRimCases } = await import('./metal-rim-cases.mjs');
  assert.deepEqual(cases, metalRimCases());
}
assert.equal(native.device, 'Apple M1');
assert.equal(native.results.length, cases.length);
assert.equal(webgl.results.length, cases.length);
assert.deepEqual(webgl.errors, []);
for (const r of inputs) {
  const retained = byFile.get(r.path);
  assert(retained, r.path);
  assert.equal(retained.bytes, r.bytes, r.path);
  assert.equal(retained.sha256, r.sha256, r.path);
}
for (const [program, digest] of [
  [1, '6b86adbd5b6f807e71248eff97c03fd42b5db82e9de81578dfebca0cb60dfb12'],
  [9, '6f497054a40a4ce2d84f7e217872ce4ec3a482e2c01361a70f82d546924e63f3'],
  [24, 'ae3c69a06bf883597412669be3ccd0309a7c0683d061908795fa6f96a2e80d30'],
])
  assert.equal(inputs.find((r) => r.program === program)?.sha256, digest);
const difference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
assert.equal(comparison.cases, cases.length);
const computed = cases.map((o, i) => {
  const n = native.results[i],
    w = webgl.results[i],
    scalar = expectedMetalRim(o);
  assert.equal(n.id, o.id);
  assert.equal(w.id, o.id);
  assert.equal(n.commandStatus, 'completed');
  assert.equal(n.vertexProgram, 1);
  assert.equal(n.fragmentProgram, (o.alphaRef ?? 0) > 0 ? 24 : 9);
  assert.equal(w.error, 0);
  assert.equal(w.cubeResources, 0);
  for (const pixel of [n.pixels, w.pixels]) {
    assert.equal(pixel.length, 4);
    assert(pixel.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
  }
  return {
    id: o.id,
    metal: n.pixels,
    webgl: w.pixels,
    scalar,
    metalScalarMax: difference(n.pixels, scalar),
    webglScalarMax: difference(w.pixels, scalar),
    metalWebglMax: difference(n.pixels, w.pixels),
  };
});
assert.deepEqual(comparison.comparisons, computed);
for (const [field, key] of [
  ['maxMetalScalar', 'metalScalarMax'],
  ['maxWebglScalar', 'webglScalarMax'],
  ['maxMetalWebgl', 'metalWebglMax'],
]) {
  assert.equal(comparison[field], Math.max(...computed.map((r) => r[key])));
  assert.equal(comparison[field], 0);
}
const pixel = (id) => native.results.find((r) => r.id === id)?.pixels;
assert.deepEqual(pixel('threshold-99'), [0, 0, 0, 0]);
assert.equal(pixel('threshold-102')[3], 5);
assert.deepEqual(pixel('threshold-100'), [0, 0, 0, 0]);
assert.equal(pixel('threshold-103')[3], 5);
assert.equal(pixel('threshold-81')[0], 64);
assert(difference(pixel('power-facing-141'), pixel('power-facing-144')) > 40);
assert(difference(pixel('interpolation-130'), pixel('interpolation-136')) > 0);
assert(difference(pixel('uv-148'), pixel('uv-149')) > 10);
for (const name of ['compile', 'native']) {
  const command = json(path(`${name}-command.json`));
  assert.equal(command.status, 0);
  assert.equal(command.signal, null);
  assert.equal(readFileSync(frozen(path(`${name}-stderr.log`)), 'utf8'), '');
}
const binary = json(path('executable.json'));
assert.equal(sha(frozen(binary.path)), binary.sha256);
assert.equal(readFileSync(frozen(binary.path)).length, binary.bytes);
assert.deepEqual(json(path('native-stdout.log')), native);
const nativeCommand = json(path('native-command.json'));
assert.equal(nativeCommand.command, binary.path);
assert.deepEqual(
  nativeCommand.args.map((p) => (isAbsolute(p) ? relative(process.cwd(), p) : p)),
  [...inputs.filter((r) => r.program).map((r) => r.path), path('cases.json')]
);
if (pin.negativeChecks) {
  const controls = json(pin.negativeChecks);
  assert.deepEqual(
    controls.map((r) => r.case),
    ['missing-case', 'changed-pixel', 'changed-library-record']
  );
  assert(controls.every((r) => r.rejected === true && r.exitCode !== 0));
}
console.log('PASS: 150 original Metal / WebGL / scalar samples; offline verification only');
