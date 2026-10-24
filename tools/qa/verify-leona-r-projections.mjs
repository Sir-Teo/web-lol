/** Frozen local planar receiver acceptance; native CPU/frame parity stays open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-projection-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [
  ...source,
  ...ledger.generated,
  ...ledger.readers,
  ...ledger.native,
  ...ledger.evidence,
]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (p) => source.find((r) => r.file === p).archived,
  readers = json(frozen('docs/reference/leona-r-projection-readers.json')),
  inputs = new Map(ledger.readers.map((p) => [p.file, p]));
assert.equal(readers.files.length, 12);
for (const p of readers.files) assert.equal(inputs.get(p.path).sha256, p.sha256, p.path);
const reading = json(frozen('docs/reference/leona-r-projection-reading.json'));
assert.equal(reading.nativeExecuted, false);
assert.deepEqual(reading.localIntegration.families, [12, 18]);
const shaders = json(frozen('docs/reference/leona-r-decal-shaders.json')),
  native = new Map(ledger.native.map((p) => [p.file, p]));
assert.equal(shaders.nativeExecuted, false);
assert.equal(shaders.selections.length, 6);
for (const p of shaders.selections) {
  const bundle = readFileSync(
      native.get('.cache/leona-r-decal-shaders-v2-20261024/native/' + p.bundle).archived
    ),
    metal = readFileSync(native.get(p.metallib.path).archived),
    bitcode = readFileSync(native.get(p.bitcode.path).archived);
  assert.equal(bundle.readUInt32LE(p.bundleProgramOffset - 4), metal.length);
  assert(
    metal.equals(bundle.subarray(p.bundleProgramOffset, p.bundleProgramOffset + metal.length))
  );
  assert(bitcode.equals(metal.subarray(p.bitcode.offset, p.bitcode.offset + bitcode.length)));
  for (const kind of ['metallib', 'bitcode', 'disassembly'])
    assert.equal(native.get(p[kind].path).sha256, p[kind].sha256);
}
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1874 passed \(1874\)/);
assert.match(standard, /308 passed \(308\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /13 passed/);
assert.equal(c.colors.length, 2);
assert.deepEqual(
  c.colors.map((p) => json(p).before.models[0].profileIndex).sort((a, b) => a - b),
  [12, 18]
);
for (const path of c.colors) {
  const e = json(path);
  assert.deepEqual(e.errors, []);
  assert.deepEqual(e.before, e.restored);
  assert.equal(e.before.snapshot, e.prepared.snapshot);
  assert.equal(e.before.models.length, 1);
  assert([12, 18].includes(e.before.models[0].profileIndex));
  assert.equal(e.before.models[0].attachment, 'saved-fixed-area-receivers');
  assert(e.visible.changed > 10 && e.visible.changed < e.visible.totalPixels * 0.2);
  assert.equal(e.visible.error, 0);
  const saved = JSON.parse(e.before.snapshot);
  assert.equal(saved.version, 126);
  assert.equal(saved.ruleset, ledger.ruleset);
}
const storage = json(c.storage);
assert.deepEqual(storage.before, storage.recovered);
assert.equal(storage.rounds.length, 6);
assert(
  storage.rounds.every(
    (r) => r.remaining === 0 && r.geometry === 1 && r.material === 1 && r.borrowed === 0
  )
);
assert(
  storage.rounds
    .slice(1)
    .every((r) => JSON.stringify(r.memory) === JSON.stringify(storage.rounds[1].memory))
);
const rift = json(c.rift);
assert.equal(rift.result.lazy, 0);
assert(rift.result.indexed > 1000);
assert.equal(rift.result.projected.length, 1);
assert(rift.result.projected[0].receiverCorners > 6);
assert.equal(rift.result.projected[0].receiverTriangles, rift.result.indexed);
assert(rift.result.projected[0].maxY > rift.result.projected[0].minY);
assert.equal(rift.result.before, rift.result.after);
assert.equal(rift.result.error, 0);
assert(rift.visible.changed > 10);
const production = readFileSync(c.production, 'utf8')
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((p) => p?.recordings);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline),
  pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, ledger.pack.id);
assert.equal(pack.files.length, ledger.pack.files);
assert.equal(pack.bytes, ledger.pack.bytes);
assert.equal(offline.manifest.id, pack.id);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
for (const p of pack.files) {
  const file =
    ledger.generated.find((r) => r.file === `dist/${p.path}`)?.archived ??
    source.find((r) => r.file === `public/${p.path}`)?.archived;
  assert(file, p.path);
  assert.equal(hash(file), p.sha256);
  assert.equal(readFileSync(file).length, p.bytes);
}
assert.equal(ledger.acceptance.sourceRProjectionsIntegrated, true);
for (const key of [
  'sourceRComplete',
  'nativeCpuVerified',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    projectorFamilies: 2,
    totalIntegratedFamilies: 38,
    browserCases: 13,
    files: ledger.pack.files,
    ruleset: ledger.ruleset,
  })
);
