/** Frozen evidence only: no compiler, library loading, browser or GPU work. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2),
  index = args.indexOf('--pin'),
  historical = args.includes('--historical');
const pin = JSON.parse(
  readFileSync(
    index < 0 ? 'docs/reference/leona/metal-skin-lookup-verification.json' : args[index + 1]
  )
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
const difference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const digests = new Map([
  [0, '129c06c6d4aeeb30090665c4b9a96f8222cda7c9b910f8d9fed54d074fb98397'],
  [11, '9aafc8fe2b07c5d5420210480ed0cacfd37f3667660cfdf3b13d8d74336524d3'],
  [34, 'f766696d141aa3b772612ec73476e9c745e3b7dceb84410b4de68a7190442fcd'],
]);
async function verifyRun(run, lookup) {
  const path = (name) => run + '/' + name,
    modulePath = 'tools/qa/metal-skin-' + (lookup ? 'lookup-' : '') + 'cases.mjs';
  const module = await import(pathToFileURL(frozen(modulePath))),
    make = lookup ? module.metalSkinLookupCases : module.metalSkinCases,
    expected = lookup ? module.expectedMetalSkinLookup : module.expectedMetalSkin;
  const cases = json(path('cases.json')),
    native = json(path('native.json')),
    webgl = json(path('webgl.json')),
    comparison = json(path('comparison.json')),
    inputs = json(path('inputs.json')),
    snapshots = json(path('input-snapshots.json'));
  assert.equal(cases.length, lookup ? 100 : 88);
  assert.deepEqual(cases, make());
  if (!historical) {
    const current = await import(new URL('../../' + modulePath, import.meta.url));
    assert.deepEqual(cases, lookup ? current.metalSkinLookupCases() : current.metalSkinCases());
  }
  for (const input of inputs) {
    const row = files.get(input.path);
    assert(row, input.path);
    assert.equal(row.bytes, input.bytes, input.path);
    assert.equal(row.sha256, input.sha256, input.path);
  }
  assert.equal(snapshots.length, inputs.length);
  snapshots.forEach((s, i) => {
    assert.equal(s.path, inputs[i].path);
    assert.equal(s.sha256, inputs[i].sha256);
    assert.equal(s.bytes, inputs[i].bytes);
    assert.equal(sha(frozen(s.snapshot)), s.sha256);
    assert.equal(readFileSync(frozen(s.snapshot)).length, s.bytes);
  });
  const programs = inputs.filter((r) => r.program !== undefined);
  assert.deepEqual(
    programs.map((r) => r.program),
    [0, lookup ? 11 : 34]
  );
  for (const p of programs) assert.equal(p.sha256, digests.get(p.program));
  assert.equal(native.device, 'Apple M1');
  assert.equal(native.results.length, cases.length);
  assert.deepEqual(webgl.errors, []);
  const compared = cases.filter((o) => o.webglSupported !== false);
  assert.equal(compared.length, lookup ? 76 : 88);
  assert.equal(webgl.results.length, compared.length);
  if (lookup)
    for (const o of compared) {
      assert.deepEqual(o.lookup, [255, 255, 255, 255]);
      assert.equal(o.lookupWidth ?? 1, 1);
    }
  const byId = new Map(webgl.results.map((r) => [r.id, r]));
  assert.equal(byId.size, compared.length);
  const computed = cases.map((o, i) => {
    const n = native.results[i],
      w = byId.get(o.id),
      scalar = expected(o);
    assert.equal(n.id, o.id);
    assert.equal(n.commandStatus, 'completed');
    const eligible = o.webglSupported !== false;
    assert.equal(!!w, eligible);
    if (w) {
      assert.equal(w.id, o.id);
      assert.equal(w.error, 0);
    }
    for (const p of [n.pixels, ...(w ? [w.pixels] : [])])
      assert(p.length === 4 && p.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    return {
      id: o.id,
      metal: n.pixels,
      webgl: w?.pixels ?? null,
      scalar,
      metalScalarMax: difference(n.pixels, scalar),
      webglScalarMax: w ? difference(w.pixels, scalar) : null,
      metalWebglMax: w ? difference(n.pixels, w.pixels) : null,
    };
  });
  assert.equal(comparison.cases, cases.length);
  assert.equal(comparison.webglCases, compared.length);
  assert.deepEqual(comparison.comparisons, computed);
  for (const [field, value] of [
    ['maxMetalScalar', 'metalScalarMax'],
    ['maxWebglScalar', 'webglScalarMax'],
    ['maxMetalWebgl', 'metalWebglMax'],
  ]) {
    assert.equal(
      comparison[field],
      Math.max(...computed.flatMap((r) => (r[value] === null ? [] : [r[value]])))
    );
    assert.equal(comparison[field], 0);
  }
  if (lookup) {
    const pixel = (id) => native.results.find((r) => r.id === id).pixels;
    for (const alpha of [0, 64, 128, 255]) {
      const prefix = `lookup-alpha-${alpha}-`,
        suffix = '-0.3449999988079071';
      assert.deepEqual(
        pixel(prefix + '0' + suffix).slice(0, 3),
        pixel(prefix + '1' + suffix).slice(0, 3)
      );
      assert.equal(pixel(prefix + '0' + suffix)[3], 0);
    }
    assert.deepEqual(pixel('lookup-zero-remap-1'), [240, 20, 170, 0]);
    assert.deepEqual(pixel('lookup-zero-remap-255'), [240, 20, 170, 0]);
    assert(difference(pixel('lookup-uv-0.25-0.25'), pixel('lookup-uv-0.25-0.75')) > 10);
  }
  for (const name of ['compile', 'native']) {
    const command = json(path(name + '-command.json'));
    assert.equal(command.status, 0);
    assert.equal(command.signal, null);
    assert.equal(readFileSync(frozen(path(name + '-stderr.log')), 'utf8'), '');
  }
  const binary = json(path('executable.json'));
  assert.equal(sha(frozen(binary.path)), binary.sha256);
  assert.equal(readFileSync(frozen(binary.path)).length, binary.bytes);
  assert.deepEqual(json(path('native-stdout.log')), native);
  const command = json(path('native-command.json'));
  assert.equal(command.command, binary.path);
  assert.deepEqual(command.args.map(key), [
    ...(lookup ? ['--lookup'] : []),
    ...programs.map((r) => r.path),
    path('cases.json'),
  ]);
  const scope = json(path('scope.json'));
  assert.equal(scope.depthPush, 0);
  assert.equal(scope.nativeGameExecuted, false);
  assert.equal(scope.webglCompared, compared.length);
  return { native: cases.length, webgl: compared.length };
}
assert.equal(pin.nativeGameExecuted, false);
assert.equal(pin.nativeShaderExecuted, true);
assert.equal(pin.nativeGameplayFrameVerified, false);
const a = await verifyRun(pin.run, true),
  b = await verifyRun(pin.erosionRegression, false);
for (const path of pin.staticReadings) {
  const reading = json(path);
  for (const input of reading.inputs) {
    const row = files.get(input.path);
    assert(row, input.path);
    assert.equal(row.sha256, input.sha256);
    assert.equal(row.bytes, input.bytes);
  }
}
const abi = json(pin.independentAbi);
const review = json(pin.harnessReview);
for (const input of [review.previousReview, review.runner, ...review.unchangedCoreInputs]) {
  const row = files.get(input.path);
  assert(row, input.path);
  assert.equal(row.sha256, input.sha256);
  assert.equal(row.bytes, input.bytes);
}
assert.deepEqual(
  abi.fragmentABI.filter((r) => r.kind === 'air.buffer').map((r) => [r.slot, r.bytes]),
  [[16, 8]]
);
assert.deepEqual(abi.matchingInterface, [
  ['TEXCOORD0', 'float4', 'user(locn0)'],
  ['TEXCOORD1', 'float3', 'user(locn1)'],
  ['COLOR0', 'float3', 'user(locn2)'],
]);
if (pin.negativeChecks) {
  const controls = json(pin.negativeChecks);
  assert.deepEqual(
    controls.map((r) => r.case),
    [
      'missing-case',
      'changed-pixel',
      'changed-library-record',
      'unsupported-webgl',
      'changed-input-snapshot',
    ]
  );
  assert(controls.every((r) => r.rejected && r.exitCode !== 0));
}
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    originalMetalScalar: a.native + b.native,
    localWebglCompared: a.webgl + b.webgl,
    lookupControlsWithoutWebgl: a.native - a.webgl,
    maxDifference: 0,
    execution: 'offline verification only',
  })
);
