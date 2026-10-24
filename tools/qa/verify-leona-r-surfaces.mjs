/** Frozen local R surface acceptance; no native CPU/frame equivalence inferred. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-surface-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated, ...ledger.readers]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (p) => source.find((r) => r.file === p).archived,
  data = json(frozen('src/content/leona-r-particles.json')),
  readers = json(frozen('docs/reference/leona-r-surface-readers.json')),
  readerMap = new Map(ledger.readers.map((p) => [p.file, p])),
  accepted = data.profiles.flatMap((p, i) =>
    p.texture &&
    p.role !== 'buff' &&
    ['quad', 'billboard', 'mesh', 'ray'].includes(p.kind) &&
    (!p.distortion || p.distortion.mode === 1)
      ? [i]
      : []
  );
assert.equal(data.profiles.length, 44);
assert.equal(data.disabled.length, 9);
assert.equal(accepted.length, 35);
assert.deepEqual(
  data.profiles.flatMap((_p, i) => (accepted.includes(i) ? [] : [i])),
  [0, 1, 2, 3, 12, 18, 27, 30, 33]
);
assert.equal(
  data.profiles.every((p) => p.soft === null),
  true
);
assert.equal(readers.files.length, 28);
assert.equal(readers.nativeCpuVerified, false);
for (const p of readers.files) {
  assert.equal(readerMap.get(p.path).sha256, p.sha256, p.path);
  assert.equal(readerMap.get(p.path).bytes, p.bytes, p.path);
}
const inventory = json(ledger.checks.nativeInventory);
assert.equal(inventory.programs.length, 15);
assert.equal(new Set(inventory.programs.map((p) => p.table)).size, 4);
for (const p of inventory.programs)
  for (const kind of ['metallib', 'bitcode', 'disassembly'])
    assert.equal(readerMap.get(p[kind].path).sha256, p[kind].sha256, p[kind].path);
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1849 passed \(1849\)/);
assert.match(standard, /304 passed \(304\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /7 passed/);
const allSeen = new Set();
assert.equal(c.families.length, 2);
for (const file of c.families) {
  const r = json(file);
  assert.deepEqual(r.errors, []);
  assert.equal(r.seen.length, 30);
  assert(r.seen.every(([, pixels]) => pixels > 0));
  const indices = r.seen.map(([i]) => i);
  assert(!indices.some((i) => i >= 11 && i <= 16) || !indices.some((i) => i >= 17 && i <= 22));
  for (const [i] of r.seen) {
    assert(accepted.includes(i));
    allSeen.add(i);
  }
  for (const stage of r.stages) {
    assert.equal(stage.error, 0);
    assert(stage.profiles.every((p) => p.changed < stage.totalPixels * 0.5));
  }
}
assert.deepEqual(
  [...allSeen].sort((a, b) => a - b),
  accepted
);
assert.equal(c.restores.length, 2);
for (const file of c.restores) {
  const r = json(file);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.restored, r.before);
  assert.deepEqual(r.recovered, r.before);
  assert(r.before.models.length > 0);
  assert.equal(r.before.error, 0);
  const saved = JSON.parse(r.before.snapshot);
  assert.equal(saved.version, 126);
  assert.equal(saved.ruleset, ledger.ruleset);
}
const storage = json(c.storage);
assert.deepEqual(storage.errors, []);
assert.equal(storage.rounds.length, 6);
for (const r of storage.rounds) {
  assert(r.active > 0 && r.owned > 0 && r.geometry >= r.owned);
  assert.equal(r.materials, r.active);
  assert.equal(r.remaining, 0);
  assert.equal(r.depthActive, false);
  assert.equal(r.depthRemaining, false);
  assert.equal(r.copyActive, true);
  assert.equal(r.copyRemaining, false);
}
assert(
  storage.rounds
    .slice(1)
    .every((r) => JSON.stringify(r.memory) === JSON.stringify(storage.rounds[1].memory))
);
for (const file of [c.wComparison, c.eComparison]) {
  const r = json(file);
  assert.deepEqual(r.errors, []);
  assert.equal(r.samples.length, 63);
  assert.equal(r.currentCoreSha256, hash(frozen('src/render/source-particle-surfaces.ts')));
  assert(r.samples.every((s) => s.different === 0 && s.stateEqual && s.error === 0));
  assert.equal(hash(r.baseline), r.baselineSha256);
  if (r.baselineWrapper) assert.equal(hash(r.baselineWrapper), r.baselineWrapperSha256);
}
const attributes = json(c.attributes);
assert.deepEqual(attributes.errors, []);
assert.equal(attributes.result.ruleset, ledger.ruleset);
assert.equal(attributes.result.samples.length, 44);
const production = readFileSync(c.production, 'utf8')
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((r) => r?.recordings);
assert.equal(production.recordings, 32);
assert.equal(production.result, 'passed');
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline),
  pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, ledger.pack.id);
assert.equal(pack.files.length, ledger.pack.files);
assert.equal(pack.bytes, ledger.pack.bytes);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, pack.id);
assert.equal(offline.manifest.files, pack.files.length);
assert.equal(offline.manifest.bytes, pack.bytes);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const [key, value] of Object.entries(offline.checks)) {
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
}
for (const p of pack.files) {
  const file =
    ledger.generated.find((r) => r.file === `dist/${p.path}`)?.archived ??
    source.find((r) => r.file === `public/${p.path}`)?.archived;
  assert(file, p.path);
  assert.equal(hash(file), p.sha256, p.path);
  assert.equal(readFileSync(file).length, p.bytes, p.path);
}
assert.equal(ledger.acceptance.sourceRSurfacesIntegrated, true);
for (const key of [
  'sourceRComplete',
  'nativeCpuVerified',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    families: 35,
    oppositeAreaAlternatives: true,
    browserCases: 7,
    frozenWFrames: 63,
    frozenEFrames: 63,
    files: ledger.pack.files,
    ruleset: ledger.ruleset,
  })
);
