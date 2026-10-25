/** Offline verification only; never compiles, loads a library or submits GPU work. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2),
  index = args.indexOf('--pin'),
  historical = args.includes('--historical');
const pin = JSON.parse(
  readFileSync(index < 0 ? 'docs/reference/leona/metal-skin-verification.json' : args[index + 1])
);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const key = (p) => (isAbsolute(p) ? relative(process.cwd(), p) : p);
const files = new Map();
for (const row of pin.files) {
  assert(!files.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(sha(row.archived), row.sha256, row.archived);
  if (!historical && row.current) assert.equal(sha(row.file), row.sha256, row.file);
  files.set(row.file, row);
}
const frozen = (p) => {
  assert(files.has(key(p)), p);
  return files.get(key(p)).archived;
};
const json = (p) => JSON.parse(readFileSync(frozen(p)));
const run = pin.run,
  path = (name) => run + '/' + name;
const module = await import(pathToFileURL(frozen('tools/qa/metal-skin-cases.mjs')));
const cases = json(path('cases.json')),
  native = json(path('native.json')),
  webgl = json(path('webgl.json')),
  comparison = json(path('comparison.json')),
  inputs = json(path('inputs.json'));
assert.equal(cases.length, 88);
assert.deepEqual(cases, module.metalSkinCases());
if (!historical) {
  const current = await import('./metal-skin-cases.mjs');
  assert.deepEqual(cases, current.metalSkinCases());
}
for (const input of inputs) {
  const row = files.get(input.path);
  assert(row, input.path);
  assert.equal(row.sha256, input.sha256, input.path);
  assert.equal(row.bytes, input.bytes, input.path);
}
const programs = inputs.filter((r) => r.program !== undefined);
assert.deepEqual(
  programs.map((r) => r.program),
  [0, 34]
);
assert.equal(
  programs[0].sha256,
  '129c06c6d4aeeb30090665c4b9a96f8222cda7c9b910f8d9fed54d074fb98397'
);
assert.equal(
  programs[1].sha256,
  'f766696d141aa3b772612ec73476e9c745e3b7dceb84410b4de68a7190442fcd'
);
assert.equal(native.device, 'Apple M1');
assert.equal(native.results.length, cases.length);
assert.equal(webgl.results.length, cases.length);
assert.deepEqual(webgl.errors, []);
const difference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const computed = cases.map((o, i) => {
  const n = native.results[i],
    w = webgl.results[i],
    scalar = module.expectedMetalSkin(o);
  assert.equal(n.id, o.id);
  assert.equal(w.id, o.id);
  assert.equal(n.commandStatus, 'completed');
  assert.equal(w.error, 0);
  for (const p of [n.pixels, w.pixels])
    assert(p.length === 4 && p.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
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
assert.equal(comparison.cases, 88);
assert.deepEqual(comparison.comparisons, computed);
for (const [field, value] of [
  ['maxMetalScalar', 'metalScalarMax'],
  ['maxWebglScalar', 'webglScalarMax'],
  ['maxMetalWebgl', 'metalWebglMax'],
]) {
  assert.equal(comparison[field], Math.max(...computed.map((r) => r[value])));
  assert.equal(comparison[field], 0);
}
const pixels = (id) => native.results.find((r) => r.id === id).pixels;
assert(difference(pixels('power-0.05000000074505806'), pixels('power-0.3449999988079071')) > 30);
assert(difference(pixels('power-0.15000000596046448'), pixels('power-0.8350000381469727')) > 50);
assert(difference(pixels('uv-0'), pixels('uv-0.5')) > 10);
assert.deepEqual(pixels('last-palette-bone'), module.expectedMetalSkin(cases.at(-1)));
for (const name of ['compile', 'native']) {
  const command = json(path(name + '-command.json'));
  assert.equal(command.status, 0);
  assert.equal(command.signal, null);
  assert.equal(readFileSync(frozen(path(name + '-stderr.log')), 'utf8'), '');
}
const executable = json(path('executable.json'));
assert.equal(sha(frozen(executable.path)), executable.sha256);
assert.equal(readFileSync(frozen(executable.path)).length, executable.bytes);
assert.deepEqual(json(path('native-stdout.log')), native);
const command = json(path('native-command.json'));
assert.equal(command.command, executable.path);
assert.deepEqual(command.args.map(key), [...programs.map((r) => r.path), path('cases.json')]);
const scope = json(path('scope.json'));
assert.equal(scope.nativeGameExecuted, false);
assert.equal(scope.depthPush, 0);
assert.equal(pin.nativeGameExecuted, false);
assert.equal(pin.nativeShaderExecuted, true);
assert.equal(pin.nativeGameplayFrameVerified, false);
const abi = json(pin.independentAbi);
assert.deepEqual(abi.interfaceMatch, [
  ['TEXCOORD0', 'float4', 'user(locn0)'],
  ['TEXCOORD1', 'float3', 'user(locn1)'],
  ['COLOR0', 'float3', 'user(locn2)'],
]);
assert.deepEqual(
  abi.vertexABI.filter((r) => r.kind === 'air.buffer').map((r) => [r.slot, r.bytes]),
  [
    [0, 12288],
    [1, 560],
    [9, 144],
  ]
);
assert.deepEqual(
  abi.fragmentABI.filter((r) => r.kind === 'air.buffer').map((r) => [r.slot, r.bytes]),
  [[16, 32]]
);
for (const reading of [
  abi,
  json('.cache/leona-skin-metal-abi-v1-20261024/abi.json'),
  json(pin.harnessReview),
])
  for (const input of reading.inputs) {
    const row = files.get(input.path);
    assert(row, input.path);
    assert.equal(row.sha256, input.sha256);
    assert.equal(row.bytes, input.bytes);
  }
if (pin.paletteRejection) {
  const result = json(pin.paletteRejection);
  assert.equal(result.rejected, true);
  assert.equal(result.exitCode, 1);
  const invalid = json(pin.paletteRejection.replace('result.json', 'cases.json'));
  assert.equal(invalid[0].joints[0], 256);
  assert.match(
    readFileSync(frozen(pin.paletteRejection.replace('result.json', 'stderr.log')), 'utf8'),
    /invalid synthetic input/
  );
  assert.equal(
    readFileSync(frozen(pin.paletteRejection.replace('result.json', 'stdout.log')), 'utf8'),
    ''
  );
}
if (pin.negativeChecks) {
  const controls = json(pin.negativeChecks);
  assert.equal(controls.length, 3);
  assert(controls.every((r) => r.rejected && r.exitCode !== 0));
}
console.log(
  'PASS: 88 original skin Metal / WebGL / scalar samples, byte-exact; offline verification only'
);
