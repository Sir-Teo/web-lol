/** Read-only source/artifact/evidence checks. Native playback is still open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ledger = json('docs/reference/leona/w-source-verification.json');
function verify(p, path = p.file) {
  const data = readFileSync(path);
  assert.equal(data.length, p.bytes, path);
  assert.equal(createHash('sha256').update(data).digest('hex'), p.sha256, path);
}
for (const p of ledger.evidence) verify(p);
for (const a of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const p of json(a).files) {
    verify(p, p.archived);
    if (a === ledger.sourceArchive && !historical) verify(p);
  }
for (const p of ledger.reviewInputs) {
  verify(p, p.archived);
  if (!historical) verify(p);
}
for (const a of ledger.preservedArchives)
  for (const p of json(a).files) verify(p, p.archived ?? p.file);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(json(ledger.sourceArchive).ruleset, ledger.ruleset);
const c = ledger.checks;
assert.equal(readFileSync(c.typecheck, 'utf8'), '');
assert(readFileSync(c.standard, 'utf8').includes('1615 passed (1615)'));
assert(readFileSync(c.standard, 'utf8').includes('279 passed (279)'));
assert(readFileSync(c.nodeQa, 'utf8').includes('pass 3'));
assert(readFileSync(c.nodeQa, 'utf8').includes('fail 0'));
assert(
  readFileSync(c.failedTypecheck, 'utf8').includes(
    "Could not find a declaration file for module 'gltf-validator'"
  )
);
const source = json(c.source),
  reproduced = json(c.reproduction);
for (const report of [source, reproduced]) {
  assert.equal(report.result, 'passed');
  assert.equal(report.systems, 5);
  assert.equal(report.emitters, 50);
  assert.equal(report.enabled, 30);
  assert.equal(report.textures, 36);
  assert.equal(report.meshes, 6);
  assert.equal(report.runtimeIntegrated, false);
  assert.equal(report.nativeRenderingVerified, false);
}
assert.equal(source.disabled, 20);
assert.equal(reproduced.check, true);
const production = json(c.production);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.files, 878);
assert.equal(offline.manifest.bytes, 499066391);
for (const key of [
  'integrityFailure',
  'cancelRetainsVerified',
  'retryWithoutRedownload',
  'pausedSavedTickBootsOffline',
  'completePackRepairOffline',
  'newLuxLaneMatchOffline',
  'removalKeepsSavedBytes',
  'updateRefusesOtherTabs',
  'explicitAtomicVersionSwitchOffline',
  'missingEntryRevokesReady',
  'scopeOnlyRemoval',
])
  assert.equal(offline.checks[key], true, key);
assert(offline.checks.serviceWorkerResponses > 0);
const comparison = json(c.comparison),
  before = json(comparison.prior),
  after = json(comparison.next);
assert.equal(offline.manifest.id, after.id);
assert.equal(before.workerPolicySha256, after.workerPolicySha256);
assert.equal(before.files.length, 833);
assert.equal(after.files.length, 878);
const prior = new Map(before.files.map((p) => [p.path, p]));
const next = new Map(after.files.map((p) => [p.path, p]));
for (const p of before.files) assert.deepEqual(next.get(p.path), p);
const added = after.files.filter((p) => !prior.has(p.path));
assert.deepEqual(added, comparison.added);
assert.equal(added.length, 45);
assert.equal(
  added.reduce((n, p) => n + p.bytes, 0),
  1001180
);
assert.deepEqual(comparison.changed, []);
assert.deepEqual(comparison.removed, []);
assert.equal(comparison.sameWorkerPolicy, true);
assert.equal(json(c.priorIntegrity).result, 'passed');
assert.equal(json(c.priorIntegrity).ruleset, ledger.ruleset);
assert.equal(ledger.acceptance.runtimeIntegrated, false);
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativeRenderingVerified, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 123,
    ruleset: ledger.ruleset,
    tests: 1615,
    files: 279,
    sourceInputs: json(ledger.sourceArchive).files.length,
    systems: 5,
    emitters: 50,
    enabled: 30,
    textures: 36,
    meshes: 6,
    newPublicFiles: added.length,
    newPublicBytes: 1001180,
    productionAndOfflinePassed: true,
    runtimeIntegrated: false,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  })
);
