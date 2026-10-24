/** Frozen attribute sampling; no native CPU or R drawing acceptance inferred. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-kernel-verification.json'),
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
  pin = json(frozen('docs/reference/leona-r-particles.json')),
  audit = json(frozen('docs/reference/leona-r-particle-profiles.json')),
  readers = json(frozen('docs/reference/leona-r-kernel-readers.json')),
  readerMap = new Map(ledger.readers.map((p) => [p.file, p]));
assert.equal(data.profiles.length, 44);
assert.equal(data.disabled.length, 9);
assert.equal(data.systems.length, 6);
assert.equal(audit.sourcePinSha256, hash(frozen('docs/reference/leona-r-particles.json')));
assert.equal(
  audit.decodedAssetsSha256,
  hash(frozen('docs/reference/leona-r-particles-decoded.json'))
);
assert.equal(
  audit.kernelReadersPinSha256,
  hash(frozen('docs/reference/leona-r-kernel-readers.json'))
);
assert.equal(audit.output.sha256, hash(frozen(audit.output.path)));
assert.equal(audit.nativeCpuVerified, false);
const seen = new Set();
for (const p of [...data.profiles, ...data.disabled]) {
  const original = pin.resources[p.system].definition.complexEmitterDefinitionData[p.index],
    key = `${p.system}:${p.index}`;
  assert(!seen.has(key));
  seen.add(key);
  if (p.definition) assert.deepEqual(p.definition, original);
  else {
    assert.deepEqual(p.sourceFields, Object.keys(original).sort());
    for (const f of p.sourceFields) assert(Object.hasOwn(audit.fieldRoutes, f));
  }
}
assert.equal(seen.size, 53);
for (const p of readers.files) {
  assert.equal(readerMap.get(p.path).sha256, p.sha256);
  assert.equal(readerMap.get(p.path).bytes, p.bytes);
}
assert.equal(readers.files.length, 18);
assert.equal(readers.nativeCpuVerified, false);
assert.equal(
  readerMap.get(readers.localComparisonPin.path).sha256,
  readers.localComparisonPin.sha256
);
assert.equal(
  readerMap.get(readers.localComparisonPin.path).bytes,
  readers.localComparisonPin.bytes
);
assert.equal(data.profiles.filter((p) => p.kind === 'projection').length, 2);
assert.equal(data.profiles.filter((p) => p.distortion?.mode === 2).length, 3);
assert.equal(data.profiles.filter((p) => p.noise).length, 2);
assert.equal(data.profiles.find((p) => p.name === 'Activate').texture, null);
assert.deepEqual(data.noiseDefaults.origin, [0, 0, 0]);
for (const key of ['frequency', 'radius', 'velocityDelta'])
  assert.equal(data.noiseDefaults[key], 0);
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1842 passed \(1842\)/);
assert.match(standard, /303 passed \(303\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /2 passed/);
assert.equal(json(c.export).enabled, 44);
assert.equal(json(c.export).disabled, 9);
assert.equal(json(c.export).nativeCpuVerified, false);
const gpu = json(c.attributes);
assert.deepEqual(gpu.errors, []);
const result = gpu.result;
assert.equal(result.profiles, 44);
assert.equal(result.seeks, 720);
assert.equal(result.schema, 126);
assert.equal(result.ruleset, ledger.ruleset);
assert.deepEqual(
  result.samples.map((p) => p.profile),
  Array.from({ length: 44 }, (_, i) => i)
);
for (const key of [
  'finite',
  'repeatable',
  'stoppedEmpty',
  'sameSave',
  'restoredExactly',
  'sameIds',
  'sameRng',
])
  assert.equal(result[key], true, key);
assert.equal(result.counts.length, 6);
assert(result.counts.every((p) => p.count > 0));
const production = readFileSync(c.production, 'utf8')
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((p) => p?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline),
  pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, pack.id);
assert.equal(pack.files.length, 1007);
assert.equal(pack.bytes, 513067346);
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
  const f =
    ledger.generated.find((r) => r.file === `dist/${p.path}`)?.archived ??
    source.find((r) => r.file === `public/${p.path}`)?.archived;
  assert(f, p.path);
  assert.equal(hash(f), p.sha256, p.path);
  assert.equal(readFileSync(f).length, p.bytes, p.path);
}
assert.equal(ledger.acceptance.sourceAttributesSampleable, true);
for (const key of [
  'sourceRVisualsIntegrated',
  'nativeCpuVerified',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    enabled: 44,
    disabled: 9,
    browserSeeks: 720,
    files: 1007,
    ruleset: ledger.ruleset,
    sourceRVisualsIntegrated: false,
  })
);
