/** Source surface evidence; sword/trails/audio/native acceptance remain open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-surface-verification.json');
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
const profiles = json(frozen('src/content/leona-e-particles.json')).profiles;
const accepted = profiles.flatMap((p, i) =>
  p.role !== 'sound' && !p.reflection && ['quad', 'billboard', 'mesh'].includes(p.kind) ? [i] : []
);
assert.deepEqual(accepted, [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19]);
const reading = json(frozen('docs/reference/leona-e-frame-reading.json'));
assert.equal(reading.nativeExecuted, false);
for (const p of reading.files) {
  assert.equal(hash(p.path), p.sha256, p.path);
  assert(readFileSync(frozen(p.historicalPin), 'utf8').includes(p.sha256));
}
const families = json(ledger.browser.families);
assert.deepEqual(families.errors, []);
assert.equal(families.ids.heroBrush, true);
assert.equal(families.ids.targetBrush, true);
assert.equal(families.ids.targetVisible, true);
const seen = new Map();
for (const s of families.stages) {
  assert.equal(s.error, 0);
  for (const p of s.profiles) {
    assert(p.changed < s.totalPixels * 0.5);
    seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
    if (p.profile === 3) {
      assert.equal(p.vertexBgra, false);
      assert.equal(p.vertices, 120);
    }
    if (p.profile === 15) {
      assert.equal(p.vertexBgra, true);
      assert.equal(p.soft, true);
    }
  }
}
assert.deepEqual(
  [...seen.keys()].sort((a, b) => a - b),
  accepted
);
assert([...seen.values()].every((n) => n > 0));
for (const file of ledger.browser.restores) {
  const d = json(file);
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
  assert(r.active > 0);
  assert.equal(r.owned, 3);
  assert.equal(r.materials, r.active);
  assert(r.geometry >= r.owned);
  assert.equal(r.remaining, 0);
  assert.equal(r.depthActive, true);
  assert.equal(r.depthRemaining, false);
  assert.deepEqual(r.memory, { geometries: 22, textures: 34 });
}
const comparison = json(ledger.wComparison);
assert.equal(comparison.baselineSha256, hash(ledger.frozenW));
assert.equal(comparison.currentWrapperSha256, hash(frozen('src/render/leona-eclipse-surfaces.ts')));
assert.equal(comparison.currentCoreSha256, hash(frozen('src/render/source-particle-surfaces.ts')));
assert.deepEqual(comparison.errors, []);
assert.equal(comparison.samples.length, 63);
for (const s of comparison.samples) {
  assert.equal(s.different, 0);
  assert.equal(s.stateEqual, true);
  assert.equal(s.error, 0);
  assert.equal(s.beforeChecksum, s.afterChecksum);
}
assert.match(readFileSync(ledger.standard, 'utf8'), /1797 passed \(1797\)/);
assert.match(readFileSync(ledger.standard, 'utf8'), /pass 3/);
assert.match(readFileSync(ledger.browser.combinedLog, 'utf8'), /15 passed/);
assert.match(readFileSync(ledger.browser.storageLog, 'utf8'), /1 passed/);
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
  if (key === 'serviceWorkerResponses') assert.equal(value, 963);
  else assert.equal(value, true, key);
const pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, offline.manifest.id);
assert.equal(pack.files.length, 945);
assert.equal(pack.bytes, 506716756);
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
  assert.equal(readFileSync(archived).length, p.bytes);
}
assert.equal(ledger.acceptance.nonreflectiveSurfacesIntegrated, true);
assert.equal(ledger.acceptance.trailsIntegrated, false);
assert.equal(ledger.acceptance.swordIntegrated, false);
assert.equal(ledger.acceptance.sourceEAudioIntegrated, false);
assert.equal(ledger.acceptance.nativeFrameVerified, false);
assert.equal(ledger.acceptance.fullProjectComplete, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    families: 15,
    wFrames: 63,
    files: pack.files.length,
  })
);
