/** Explicit-input shader arithmetic acceptance, separate from native R drawing. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-decal-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.native]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of source) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (p) => source.find((r) => r.file === p).archived,
  pin = json(frozen('docs/reference/leona-r-decal-shaders.json')),
  native = new Map(ledger.native.map((r) => [r.file, r]));
assert.equal(pin.nativeExecuted, false);
assert.equal(pin.nativeRenderingVerified, false);
assert.equal(pin.selections.length, 6);
assert.deepEqual(
  pin.selections.map((r) => r.programId),
  [1, 0, 8, 0, 11, 38]
);
assert.equal(pin.tocReaderSha256, hash(frozen(pin.tocReader)));
assert.equal(pin.sourcePinSha256, hash(frozen(pin.sourcePin)));
for (const r of pin.extraction.files) {
  const p = native.get('.cache/leona-r-decal-shaders-v2-20261024/native/' + r.path);
  assert.equal(p.sha256, r.sha256);
  assert.equal(p.bytes, r.bytes);
}
for (const r of [
  ...pin.externalReaders,
  ...pin.selections.flatMap((s) => [s.metallib, s.bitcode, s.disassembly]),
]) {
  assert.equal(native.get(r.path).sha256, r.sha256);
  assert.equal(native.get(r.path).bytes, r.bytes);
}
for (const s of pin.selections) {
  const bundle = readFileSync(
      native.get('.cache/leona-r-decal-shaders-v2-20261024/native/' + s.bundle).archived
    ),
    metal = readFileSync(native.get(s.metallib.path).archived),
    bitcode = readFileSync(native.get(s.bitcode.path).archived);
  assert.equal(bundle.readUInt32LE(s.bundleProgramOffset - 4), metal.length);
  assert.deepEqual(
    bundle.subarray(s.bundleProgramOffset, s.bundleProgramOffset + metal.length),
    metal
  );
  assert.deepEqual(metal.subarray(s.bitcode.offset, s.bitcode.offset + bitcode.length), bitcode);
}
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8'),
  gpu = json(c.arithmetic);
assert.match(standard, /1818 passed \(1818\)/);
assert.match(standard, /300 passed \(300\)/);
assert.match(standard, /pass 3/);
assert.match(readFileSync(c.unitFinal, 'utf8'), /3 passed \(3\)/);
assert.match(readFileSync(c.browser, 'utf8'), /1 passed/);
assert.equal(json(c.extraction).result, 'passed');
assert.equal(gpu.reports.length, 640);
assert.equal(new Set(gpu.reports.map((r) => r.name)).size, 10);
assert.equal(Math.max(...gpu.reports.map((r) => r.error)), 0);
assert.equal(gpu.floatSupported, true);
assert(gpu.hdr[0] > 1);
for (const [i, v] of gpu.hdr.entries()) assert(Math.abs(v - gpu.hdrExpected[i]) < 1e-5);
assert.equal(gpu.before.length, 256);
assert.deepEqual(gpu.before, gpu.after);
assert.equal(gpu.error, 0);
assert.deepEqual(gpu.errors, []);
assert.equal(ledger.acceptance.explicitShaderArithmeticVerified, true);
for (const key of [
  'runtimeIntegrated',
  'nativeRenderingVerified',
  'nativeExecuted',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
assert.deepEqual(ledger.generated, []);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    nativePrograms: 6,
    gpuSamples: 640,
    runtimeIntegrated: false,
  })
);
