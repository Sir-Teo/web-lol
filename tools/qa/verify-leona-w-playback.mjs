/** Read-only evidence/archive checks; full W rendering and native parity remain open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/leona/w-playback-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
}
for (const archive of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const pin of json(archive).files) {
    verify(pin, pin.archived);
    if (!historical && archive === ledger.sourceArchive) verify(pin);
  }
for (const archive of ledger.preservedArchives)
  for (const pin of json(archive).files) verify(pin, pin.archived ?? pin.file);
if (!historical)
  for (const pin of json(ledger.buildArchive).files) verify(pin, 'dist/' + pin.file);
for (const pin of ledger.reviewInputs) {
  verify(pin, pin.archived);
  if (!historical) verify(pin);
}
for (const pin of ledger.evidence) {
  verify(pin);
  verify(pin, pin.archived);
}
const source = json(ledger.sourceArchive);
assert.equal(source.schema, ledger.schema);
assert.equal(source.ruleset, ledger.ruleset);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const c = ledger.checks,
  text = (file) => readFileSync(file, 'utf8');
assert.match(text(c.unit), /1660 passed \(1660\)/);
assert.match(text(c.unit), /284 passed \(284\)/);
assert.match(text(c.build), /built in/);
assert.match(text(c.browser), /3 passed/);
assert.match(text(c.adjacentBrowser), /12 passed/);
assert.match(text(c.nodeQa), /pass 3/);
assert.match(text(c.nodeQa), /fail 0/);
const exported = JSON.parse(text(c.export).trim());
assert.equal(exported.result, 'passed');
assert.equal(exported.enabled, 30);
assert.equal(exported.disabled, 20);
const profile = json(
  source.files.find((p) => p.file === 'src/content/leona-w-particles.json').archived
);
assert.equal(profile.profiles.length, 30);
assert.equal(profile.disabled.length, 20);
assert.equal(profile.profiles.filter((p) => p.kind === 'skin').length, 4);
const skins = json(c.skins);
assert.deepEqual(skins.errors, []);
assert.deepEqual(skins.armed.map((p) => p.profileIndex).sort(), [4, 4, 5, 6]);
assert.deepEqual(
  skins.extended.map((p) => p.profileIndex),
  [9, 9]
);
assert.deepEqual(skins.initialPixels.results.map((p) => p.profile).sort(), [4, 5, 6]);
assert.deepEqual(
  skins.extendedPixels.results.map((p) => p.profile),
  [9]
);
for (const pixels of [skins.initialPixels, skins.extendedPixels]) {
  assert.equal(pixels.error, 0);
  assert(pixels.results.every((p) => p.changed > 0));
}
assert.equal(skins.movement.length, 4);
assert(skins.movement.every((delta) => delta < 1e-7));
const recovery = json(c.recovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.recovered, recovery.original);
assert.deepEqual(recovery.terminal, {
  winner: 'blue',
  active: 4,
  remaining: 0,
  frozen: true,
  bones: 4,
  materials: 4,
  shared: 0,
  sameSave: true,
  restores: true,
});
const rounds = json(c.storage);
assert.equal(rounds.length, 6);
for (const r of rounds) {
  assert.equal(r.active, 4);
  assert.equal(r.remaining, 0);
  assert.deepEqual(r.memory, { geometries: 18, textures: 16 });
}
const normal = json(c.normalVerification),
  comparison = json(c.normalComparison);
assert.equal(normal.result, 'passed');
assert.equal(normal.checkedTicks, 72000);
assert.equal(normal.roundTrips, 20);
assert.equal(normal.futureChecks, 18);
assert.equal(normal.hundredSeedInvariantGate, false);
assert.equal(comparison.result, 'passed');
assert.equal(comparison.matches.length, 20);
for (const match of comparison.matches) {
  for (const side of ['older', 'newer'])
    assert.equal(
      createHash('sha256').update(readFileSync(match[side])).digest('hex'),
      match[side + 'Sha256']
    );
  const older = json(match.older),
    newer = json(match.newer);
  newer.version = older.version;
  newer.ruleset = older.ruleset;
  for (const owner of [newer.player, ...newer.otherChampions]) {
    assert.deepEqual(owner.leonaWVisuals, []);
    delete owner.leonaWVisuals;
  }
  assert.deepEqual(newer, older);
}
const production = JSON.parse(text(c.production).trim());
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline),
  manifest = json(c.manifest);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.deepEqual(offline.manifest, {
  id: manifest.id,
  files: manifest.files.length,
  bytes: manifest.bytes,
});
assert.equal(manifest.files.length, 879);
assert.equal(manifest.bytes, 499219179);
assert.equal(offline.checks.serviceWorkerResponses, 963);
for (const [key, value] of Object.entries(offline.checks))
  if (key !== 'serviceWorkerResponses') assert.equal(value, true, key);
assert.match(text(c.failedFocused), /2 failed/);
assert.match(text(c.failedSkinFixtures), /1 failed/);
assert.match(text(c.failedFull), /9 failed/);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    archivedInputs: source.files.length,
    sampledFamilies: 30,
    renderedSkinDescriptions: 4,
    remainingUndrawnFamilies: 26,
    unitTests: 1660,
    browserCases: 3,
    checkedNormalTicks: 72000,
    productionRecordings: 32,
    offlineFiles: manifest.files.length,
    completeWPlayback: false,
    nativeCpuVerified: false,
    nativeFramesVerified: false,
    fullGoalComplete: false,
  })
);
