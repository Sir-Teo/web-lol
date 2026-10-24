/** Verify retained local rim-only material evidence; no native dispatch/frame claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const ledger = json('docs/reference/leona/e-rim-material-verification.json');
const source = json(ledger.sourceArchive).files;
for (const row of [...source, ...ledger.evidence]) {
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(sha(row.archived), row.sha256, row.archived);
}
if (!historical) {
  for (const row of source) assert.equal(sha(row.file), row.sha256, row.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const archived = (file) => source.find((r) => r.file === file).archived;
const native = json(archived('docs/reference/leona-native-reflection-inputs.json'));
assert.equal(native.nativeExecuted, false);
assert.equal(native.nativeRenderingVerified, false);
assert.equal(native.uniformMapping.fresnel.packedPower, 0.8350000381469727);
assert.deepEqual(
  native.shaderPrograms.map((r) => r.programId),
  [20, 1, 740, 9]
);
for (const row of native.shaderPrograms) {
  for (const kind of ['metallib', 'bitcode', 'disassembly']) {
    assert.equal(sha(row[kind].path), row[kind].sha256);
    assert.equal(readFileSync(row[kind].path).length, row[kind].bytes);
  }
}
let samples = 0,
  rimSamples = 0;
const pixel = (r, rim) => {
  assert.equal(r.actual.length, 4);
  assert.equal(r.expected.length, 4);
  for (let i = 0; i < 4; i++) assert(Math.abs(r.actual[i] - r.expected[i]) <= 1);
  assert.equal(r.cubeResources, rim ? 0 : 1);
  assert.equal(r.activeUniforms.includes('reflectionTexture'), !rim);
  assert.equal(r.activeUniforms.includes('reflectionParameters'), !rim);
  assert.equal(r.activeUniforms.includes('fresnel'), true);
  samples++;
  if (rim) rimSamples++;
};
for (const row of ledger.pixelChecks) {
  const d = json(row.path);
  assert.deepEqual(d.errors, []);
  assert.equal(d.results.length, row.count);
  for (const result of d.results) pixel(result, row.rimOnly);
  if (d.causal) {
    assert.equal(d.causal.length, 2);
    for (const result of d.causal) pixel(result, row.rimOnly);
    assert(d.causal[0].actual[0] - d.causal[1].actual[0] > 40);
  }
  if (d.behind) {
    assert.equal(d.behind.error, 0);
    assert.deepEqual(d.behind.pixels, [0, 255, 0, 255]);
    samples++;
    if (row.rimOnly) rimSamples++;
  }
  if (d.recovery) {
    assert.deepEqual(d.recovery.before, d.recovery.after);
    assert.equal(d.recovery.after.error, 0);
    samples += 2;
    if (row.rimOnly) rimSamples += 2;
  }
}
assert.equal(samples, 200);
assert.equal(rimSamples, 97);
const preview = json(ledger.preview);
assert.equal(preview.ready, true);
assert.deepEqual(preview.errors, []);
assert.equal(preview.results.length, 2);
assert.deepEqual(
  preview.results.map((r) => r.changedPixels),
  [5633, 5699]
);
assert.match(readFileSync(ledger.browserLog, 'utf8'), /6 passed/);
assert.match(readFileSync(ledger.unitLog, 'utf8'), /1882 passed \(1882\)/);
assert.match(readFileSync(ledger.qaLog, 'utf8'), /pass 3/);
assert.equal(readFileSync(ledger.typecheckLog, 'utf8'), '');
assert.equal(ledger.acceptance.gameViewIntegrated, false);
assert.equal(ledger.acceptance.actualNativeDispatchVerified, false);
assert.equal(ledger.acceptance.nativeFrameVerified, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    syntheticGpuSamples: samples,
    rimSamples,
    cubeRequiredByRim: false,
    gameViewIntegrated: false,
  })
);
