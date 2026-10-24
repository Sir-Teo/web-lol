/** Frozen local Zenith sword acceptance; native conclusions remain conditional. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/e-sword-verification.json'),
  source = json(ledger.sourceArchive).files,
  rows = [...source, ...ledger.generated, ...ledger.native, ...ledger.evidence];
assert.equal(hash(ledger.sourceArchive), ledger.sourceArchiveSha256);
for (const r of rows) {
  assert.equal(readFileSync(r.archived).length, r.bytes, r.archived);
  assert.equal(hash(r.archived), r.sha256, r.archived);
}
const byFile = new Map(rows.map((r) => [r.file, r]));
const frozen = (file) => {
  assert(byFile.has(file), file);
  return byFile.get(file).archived;
};
const data = (file) => json(frozen(file));
const text = (file) => readFileSync(frozen(file), 'utf8');
if (!historical) {
  for (const r of [...source, ...ledger.generated]) assert.equal(hash(r.file), r.sha256, r.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
  for (const script of [
    'tools/assets/verify-leona-native-scb-material.py',
    'tools/assets/export-leona-e-sword-material.py',
    'tools/assets/export-leona-e-sword-normals.py',
  ])
    execFileSync('python3', ['-O', script, '--check']);
}
const native = data('docs/reference/leona-native-scb-material.json'),
  normals = data('src/content/leona-e-sword-normals.json'),
  material = data('src/content/leona-e-sword-material.json');
assert.equal(native.nativeExecuted, false);
assert.equal(native.nativeShaderExecuted, false);
assert.equal(native.nativeRenderingVerified, false);
assert.equal(native.streams.length, 23);
assert.deepEqual(
  native.shaderPrograms.map((r) => r.programId),
  [31, 4, 772, 24]
);
assert.equal(native.sourceColor.authoredVertexBGRA, false);
assert.equal(native.sourceColor.conditionalNativeCornerWord, '0xff000000');
assert.equal(normals.stream.bytes, 23328);
assert.equal(normals.stream.corners, 1944);
assert.equal(
  normals.stream.sha256,
  'd6606d78c5c5c1a6a4f25cf8b14e8abfeff4bf4921d91aa65048a589b6732158'
);
assert.equal(hash(frozen('public/' + normals.stream.path)), normals.stream.sha256);
assert.deepEqual(material.shaderPrograms, { vertex: 1, fragment: 24 });
assert.deepEqual(
  material.fresnel,
  [1, 0.43921568989753723, 0.03921568766236305, 0.8350000381469727]
);
assert.equal(material.colorPacking.binding, 'kColorFactor');
assert.equal(material.colorPacking.outputAlpha, 1);
assert.equal(material.alphaRef, 5 / 255);
const c = ledger.checks;
assert.match(text(c.standard), /1887 passed \(1887\)/);
assert.match(text(c.standard), /310 passed \(310\)/);
assert.match(text(c.standard), /pass 3/);
assert.equal(text(c.qaTypecheck), '');
assert.match(text(c.regression), /40 passed/);
assert.match(text(c.materialLog), /7 passed/);
const controls = data(c.nativeControls);
assert(controls.rows.filter((r) => 'passed' in r).every((r) => r.passed));
assert.equal(controls.rows.filter((r) => r.rejected).length, 4);
const families = data(c.families);
assert.deepEqual(families.errors, []);
assert.deepEqual(
  families.seen.map(([i]) => i).sort((a, b) => a - b),
  [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19]
);
assert(families.seen.every(([, pixels]) => pixels > 0));
let swordPixels = 0;
for (const stage of families.stages) {
  assert.equal(stage.error, 0);
  for (const p of stage.profiles.filter((p) => p.profile === 18)) {
    assert.equal(p.normalCount, 1944);
    assert.equal(p.normalSha256, normals.stream.sha256);
    assert.deepEqual(p.fresnel, material.fresnel);
    assert.equal(p.alphaRef, material.alphaRef);
    assert.equal(p.tint[3], 1);
    assert.equal(p.cube, false);
    swordPixels = Math.max(swordPixels, p.changed);
  }
}
assert(swordPixels > 100);
for (const file of c.restores) {
  const r = data(file);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.before, r.restored);
  assert.deepEqual(r.before, r.recovered);
  const snapshot = JSON.parse(r.before.snapshot);
  assert.equal(snapshot.version, 126);
  assert.equal(snapshot.ruleset, ledger.ruleset);
}
const storage = data(c.storage);
assert.deepEqual(storage.errors, []);
assert.equal(storage.rounds.length, 6);
for (const r of storage.rounds) {
  assert.equal(r.remaining, 0);
  assert.equal(r.depthRemaining, false);
  assert.equal(r.materials, r.active);
  assert(r.geometry >= r.owned);
  assert.deepEqual(r.memory, { geometries: 24, textures: 47 });
}
assert(storage.rounds.slice(1).every((r) => r.uploadedImages.length === 0));
const causal = data(c.causal);
assert.deepEqual(causal.errors, []);
assert.deepEqual(causal.result.tint, [0, 0, 0, 1]);
assert.deepEqual(causal.result.fresnel, material.fresnel);
for (const key of ['hidden', 'rawPower', 'constantNormals', 'preservedZeroAlpha'])
  assert(causal.result[key].changedPixels > 5);
assert.equal(causal.result.restored.changedPixels, 0);
assert.equal(causal.result.error, 0);
let samples = 0,
  rimSamples = 0;
function pixel(r, rim) {
  assert.equal(r.actual.length, 4);
  for (let i = 0; i < 4; i++) assert(Math.abs(r.actual[i] - r.expected[i]) <= 1);
  assert.equal(r.cubeResources, rim ? 0 : 1);
  assert.equal(r.activeUniforms.includes('reflectionTexture'), !rim);
  assert.equal(r.activeUniforms.includes('fresnel'), true);
  samples++;
  if (rim) rimSamples++;
}
for (const row of c.pixelChecks) {
  const d = data(row.path);
  assert.deepEqual(d.errors, []);
  assert.equal(d.results.length, row.count);
  for (const r of d.results) pixel(r, row.rimOnly);
  for (const r of d.causal ?? []) pixel(r, row.rimOnly);
  if (d.behind) {
    assert.deepEqual(d.behind.pixels, [0, 255, 0, 255]);
    assert.equal(d.behind.error, 0);
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
assert.equal(samples, 249);
assert.equal(rimSamples, 146);
const assets = data(c.staticAssets);
assert.equal(assets.staticFilesCompared, 965);
assert.deepEqual(assets.changed, []);
assert.deepEqual(assets.added, [
  { file: 'public/' + normals.stream.path, bytes: 23328, sha256: normals.stream.sha256 },
]);
const productionLine = text(c.production)
  .split('\n')
  .find((line) => line.startsWith('{"result":"passed","prefix":'));
assert(productionLine);
const production = JSON.parse(productionLine);
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.garenFixtureInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(c.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.deepEqual(offline.manifest, ledger.pack);
assert.equal(offline.manifest.files, 1012);
assert.equal(offline.manifest.bytes, 513309163);
assert.equal(offline.checks.serviceWorkerResponses, 963);
assert(
  Object.entries(offline.checks).every(([k, v]) => k === 'serviceWorkerResponses' || v === true)
);
const manifest = data('dist/offline-pack.json');
assert.equal(manifest.id, ledger.pack.id);
for (const entry of manifest.files) {
  const r = byFile.get('dist/' + entry.path);
  assert(r, entry.path);
  assert.equal(r.bytes, entry.bytes);
  assert.equal(r.sha256, entry.sha256);
}
assert.equal(ledger.acceptance.visibleEFamilies, 19);
assert.equal(ledger.acceptance.enabledSourceEmitters, 20);
assert.equal(ledger.acceptance.nativeDispatchVerified, false);
assert.equal(ledger.acceptance.nativeFrameVerified, false);
assert.equal(ledger.acceptance.completeLeonaKit, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    browserCases: 40,
    materialGpuSamples: samples,
    visibleEFamilies: 19,
    surfaceFamilies: 16,
    swordPixels,
    nativeWordStreams: 23,
    snapshotSchema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
  })
);
