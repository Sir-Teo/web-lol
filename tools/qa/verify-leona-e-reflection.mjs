/** Retained synthetic material checks; no native dispatch or E playback claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-reflection-verification.json');
const source = json(ledger.sourceArchive).files;
for (const pin of [...source, ...ledger.evidence]) {
  assert.equal(readFileSync(pin.archived).length, pin.bytes, pin.archived);
  assert.equal(hash(pin.archived), pin.sha256, pin.archived);
}
if (!historical) {
  for (const pin of source) assert.equal(hash(pin.file), pin.sha256, pin.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const archived = (file) => source.find((p) => p.file === file).archived;
const pin = json(archived('docs/reference/leona-e-reflection-shaders.json'));
assert.deepEqual(
  pin.selections.map((s) => s.programId),
  [98, 33, 790, 54]
);
assert.equal(pin.nativeExecuted, false);
assert.equal(pin.nativeRenderingVerified, false);
for (const s of pin.selections) {
  for (const kind of ['metallib', 'bitcode', 'disassembly']) {
    assert.equal(hash(s[kind].path), s[kind].sha256, s[kind].path);
    assert.equal(readFileSync(s[kind].path).length, s[kind].bytes);
  }
  const bundle = readFileSync(ledger.shaderRoot + '/native/' + s.bundle),
    metal = readFileSync(s.metallib.path),
    air = s.bitcode;
  assert.deepEqual(
    bundle.subarray(s.bundleProgramOffset, s.bundleProgramOffset + metal.length),
    metal
  );
  assert.deepEqual(metal.subarray(air.offset, air.offset + air.bytes), readFileSync(air.path));
}
let samples = 0;
for (const [file, count] of ledger.pixelChecks) {
  const d = json(file);
  assert.deepEqual(d.errors, []);
  assert.equal(d.results.length, count);
  for (const r of d.results) {
    assert.equal(r.actual.length, 4);
    for (let i = 0; i < 4; i++) assert(Math.abs(r.actual[i] - r.expected[i]) <= 1);
  }
  samples += count;
  if (d.behind) {
    assert.equal(d.behind.error, 0);
    assert.deepEqual(d.behind.pixels, [0, 255, 0, 255]);
    samples++;
  }
  if (d.recovery) {
    assert.deepEqual(d.recovery.before, d.recovery.after);
    assert.equal(d.recovery.after.error, 0);
    samples += 2;
  }
}
assert.equal(samples, 103);
assert.match(readFileSync(ledger.standard, 'utf8'), /1785 passed \(1785\)/);
assert.match(readFileSync(ledger.standard, 'utf8'), /pass 3/);
const geometry = json(ledger.geometry);
assert.equal(geometry.meshes, 4);
assert.equal(geometry.nativeRenderingVerified, false);
assert.equal(ledger.acceptance.gameViewIntegrated, false);
assert.equal(ledger.acceptance.nativeBindingsVerified, false);
assert.equal(ledger.acceptance.nativeNormalsVerified, false);
console.log(
  JSON.stringify({ result: 'passed', historical, programs: 4, syntheticGpuSamples: samples })
);
