/** Verify this revision's full offline pack and frozen production/browser audit. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const audit = JSON.parse(readFileSync('docs/reference/offline-pack-verification.json', 'utf8'));
const manifest = JSON.parse(readFileSync('dist/offline-pack.json', 'utf8'));
assert.deepEqual(manifest, audit.pack);
assert.equal(audit.ruleset, rulesetFingerprint());
assert.equal(audit.ruleset, '6a6196f596e935bd1989d28352042f32774cf2496de0ef6be1b281d94f7945f1');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.workerPolicySha256, digest(readFileSync('tools/offline-worker.js')));
assert.equal(
  manifest.id,
  digest(JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files }))
);
assert.equal(
  manifest.files.reduce((sum, file) => sum + file.bytes, 0),
  manifest.bytes
);
assert.equal(manifest.files.length, 779);
for (const entry of manifest.files) {
  const bytes = readFileSync('dist/' + entry.path);
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(digest(bytes), entry.sha256, entry.path);
}
for (const entry of audit.evidence) {
  const bytes = readFileSync(entry.file);
  assert.equal(bytes.length, entry.bytes, entry.file);
  assert.equal(digest(bytes), entry.sha256, entry.file);
}
const production = JSON.parse(readFileSync('artifacts/offline-pack-final-production.json', 'utf8'));
assert.equal(production.result, 'passed');
assert.equal(production.manifest.id, manifest.id);
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
  assert.equal(production.checks[key], true, key);
assert(production.checks.serviceWorkerResponses > 50);
assert.deepEqual(production.productionErrors, []);
const units = readFileSync('.cache/offline-pack-unit-final.log', 'utf8');
assert.match(units, /1441 passed/);
assert.match(units, /262 passed/);
assert.match(
  readFileSync('.cache/offline-pack-browser.log', 'utf8'),
  new RegExp(`\\b${audit.validation.browserCases} passed`)
);
assert(readFileSync('dist/offline-worker.js', 'utf8').includes(JSON.stringify(manifest)));
console.log(
  JSON.stringify({
    result: 'passed',
    pack: manifest.id,
    files: manifest.files.length,
    bytes: manifest.bytes,
    ruleset: audit.ruleset,
    unitChecks: 1441,
    browserCases: audit.validation.browserCases,
    productionOffline: true,
  })
);
