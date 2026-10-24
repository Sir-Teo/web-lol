/** Frozen trail integration evidence; sword/audio/native/full-project acceptance stay open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-trail-verification.json');
const source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (file) => source.find((p) => p.file === file).archived;
const prior = json(ledger.priorSourceArchive).files;
for (const file of [
  'src/render/leona-zenith-particles.ts',
  'src/render/leona-zenith-history.ts',
  'src/render/leona-zenith-trails.ts',
  'src/render/leona-eclipse-surface-material.ts',
  'src/render/source-particle-surfaces.ts',
])
  assert.equal(hash(frozen(file)), prior.find((p) => p.file === file).sha256, file);
const reading = json(frozen('docs/reference/leona-e-trail-shader-reading.json'));
assert.equal(reading.nativeExecuted, false);
assert.equal(reading.nativeRenderingVerified, false);
assert.equal(reading.nativeSamples.length, 3);
assert.equal(reading.externalReaders.length, 5);
for (const p of [
  ...reading.externalReaders,
  ...reading.existingReaders,
  reading.sourcePin,
  reading.kernelPin,
  ...reading.nativeSamples.flatMap((s) => [s.metallib, s.bitcode, s.disassembly]),
]) {
  assert.equal(hash(p.path), p.sha256, p.path);
  assert.equal(readFileSync(p.path).length, p.bytes, p.path);
}
const families = json(ledger.browser.families),
  seen = new Map();
assert.deepEqual(families.errors, []);
for (const s of families.stages) {
  assert.equal(s.error, 0);
  for (const p of s.profiles) {
    assert(p.changed < s.totalPixels * 0.5);
    assert(p.vertices > 0);
    assert(p.vertices <= p.capacity);
    if (p.profile === 11) assert.equal(p.paletteRow, 9.5 / 16);
    if (p.profile === 14) assert.equal(p.paletteRow, undefined);
    seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
  }
}
assert.deepEqual(
  [...seen.keys()].sort((a, b) => a - b),
  [11, 14]
);
assert([...seen.values()].every((n) => n > 0));
for (const path of ledger.browser.restores) {
  const d = json(path);
  assert.deepEqual(d.errors, []);
  assert(d.before.models.length > 0);
  assert.deepEqual(d.before, d.restored);
  assert.deepEqual(d.before, d.recovered);
  assert.equal(d.before.error, 0);
}
const storage = json(ledger.browser.storage);
assert.deepEqual(storage.errors, []);
assert.equal(storage.rounds.length, 6);
for (const r of storage.rounds) {
  assert.equal(r.active, 2);
  assert.equal(r.owned, 2);
  assert.equal(r.materials, 2);
  assert.equal(r.geometry, 2);
  assert.equal(r.remaining, 0);
  assert.deepEqual(r.memory, storage.rounds[0].memory);
}
const gpu = json(ledger.browser.arithmetic);
assert.deepEqual(gpu.errors, []);
assert.equal(gpu.error, 0);
assert.equal(gpu.reports.length, 448);
assert(gpu.reports.every((p) => p.error <= 1));
assert.equal(gpu.depth.zero[1] > 0, true);
assert.deepEqual(gpu.depth.positive, [255, 0, 0, 255]);
assert.deepEqual(gpu.depth.negative, gpu.depth.zero);
assert.match(readFileSync(ledger.standard, 'utf8'), /1803 passed \(1803\)/);
assert.match(readFileSync(ledger.standard, 'utf8'), /297 passed \(297\)/);
assert.match(readFileSync(ledger.standard, 'utf8'), /pass 3/);
assert.match(readFileSync(ledger.browser.log, 'utf8'), /20 passed/);
assert.match(readFileSync(ledger.browser.surfaceStorageLog, 'utf8'), /1 passed/);
const surfaceStorage = json(ledger.browser.surfaceStorage);
assert.deepEqual(surfaceStorage.errors, []);
assert.equal(surfaceStorage.rounds.length, 6);
for (const r of surfaceStorage.rounds) {
  assert.equal(r.remaining, 0);
  assert.equal(r.depthRemaining, false);
  assert.equal(r.materials, r.active);
  assert.equal(r.geometry, r.owned);
  assert.deepEqual(r.memory, { geometries: 22, textures: 37 });
}

const production = readFileSync(ledger.production, 'utf8')
  .trim()
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((d) => d?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(ledger.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
const pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, offline.manifest.id);
assert.equal(pack.files.length, ledger.pack.files);
assert.equal(pack.bytes, ledger.pack.bytes);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const p of pack.files) {
  const archived =
    ledger.generated.find((x) => x.file === `dist/${p.path}`)?.archived ??
    source.find((x) => x.file === `public/${p.path}`)?.archived;
  assert(archived, p.path);
  assert.equal(hash(archived), p.sha256, p.path);
  assert.equal(readFileSync(archived).length, p.bytes, p.path);
}
assert.equal(ledger.acceptance.trailsIntegrated, true);
for (const key of [
  'swordIntegrated',
  'sourceEAudioIntegrated',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    trails: 2,
    gpuSamples: gpu.reports.length,
    files: pack.files.length,
  })
);
