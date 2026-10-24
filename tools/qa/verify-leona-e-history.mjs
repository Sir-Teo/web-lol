/** Read-only retained-history evidence; no claim of native or full-kit acceptance. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const text = (file) => readFileSync(file, 'utf8');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-history-verification.json');
function verify(pin, file = pin.file) {
  assert.equal(readFileSync(file).length, pin.bytes, file);
  assert.equal(hash(file), pin.sha256, file);
}
for (const archive of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const pin of json(archive).files) {
    verify(pin, pin.archived);
    if (!historical && archive === ledger.sourceArchive) verify(pin);
  }
for (const pin of json(ledger.nativeArchive).files) verify(pin, pin.archived);
for (const pin of json(ledger.buildArchive).files) {
  verify(pin, pin.archived);
  if (!historical) verify(pin, 'dist/' + pin.file);
}
for (const pin of ledger.reviewInputs) {
  verify(pin, pin.archived);
  if (!historical) verify(pin);
}
for (const pin of ledger.evidence) {
  verify(pin);
  verify(pin, pin.archived);
}
const source = json(ledger.sourceArchive),
  c = ledger.checks;
assert.equal(source.schema, 125);
assert.equal(source.ruleset, ledger.ruleset);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text(c.standard), /1721 passed \(1721\)/);
assert.match(text(c.standard), /288 passed \(288\)/);
assert.match(text(c.standard), /pass 3/);
assert.match(text(c.standard), /fail 0/);
assert.equal(text(c.e2eTypecheck), '');
assert.match(text(c.focused), /64 passed \(64\)/);
assert.match(text(c.browser), /4 passed/);
const adjacent = text(c.adjacentBrowser);
assert.match(adjacent, /10 passed/);
assert.equal(
  [
    ...adjacent.matchAll(
      /✓.*e2e\/(?:bot-wave-advance|garen-aa-particles|leona-fixture-gate)\.spec\.ts/g
    ),
  ].length,
  7
);
const phases = new Set();
for (const file of c.browserEvidence) {
  const r = json(file);
  phases.add(r.phase);
  assert.equal(r.prepared.saved, r.result.saved);
  assert.equal(r.prepared.future, r.result.future);
  assert.deepEqual(r.prepared.history, r.result.history);
  assert.equal(r.prepared.history.startTick, r.prepared.startTick);
  assert.equal(r.prepared.rejected, true);
  assert.deepEqual(r.errors, []);
  if (r.phase === 'windup') assert.equal(r.result.history.flight, null);
  if (r.phase === 'flight') assert.equal(r.result.history.flight.stopTick, null);
  if (r.phase === 'dash') assert.equal(r.result.history.dash.stopTick, null);
  if (r.phase === 'arrival') assert(r.result.history.arrival);
}
assert.deepEqual([...phases].sort(), ['arrival', 'dash', 'flight', 'windup']);
const bound = json(
  source.files.find((p) => p.file === 'src/content/leona-e-history-bounds.json').archived
);
assert.equal(
  bound.sourcePinSha256,
  source.files.find((p) => p.file === 'docs/reference/leona-e-particles.json').sha256
);
assert.equal(bound.records.length, 20);
assert.deepEqual(bound.bounds, {
  sound: 722,
  contact: 132,
  arrival: 209,
  dash: 39,
  weapon: 770,
  history: 770,
  sourceWindow: 771,
});
assert.deepEqual(json(c.bounds).bounds, bound.bounds);
assert.match(text(c.build), /built in/);
const delivered = json(c.deliveryInputComparison),
  deliverySource = json(delivered.deliverySource);
assert.equal(delivered.result, 'passed');
assert.equal(delivered.runtimeUnchanged, true);
const changed = source.files
  .filter((p) => deliverySource.files.find((o) => o.file === p.file)?.sha256 !== p.sha256)
  .map((p) => p.file);
assert.deepEqual(changed, delivered.testOnlyChanges);
assert(changed.every((f) => f.startsWith('tests/') || f.startsWith('e2e/')));
assert.equal(deliverySource.ruleset, source.ruleset);
const production = json(c.production),
  offline = json(c.offline),
  manifest = json(c.manifest);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.unrequestedLeonaPreloads, 0);
assert.equal(production.developmentHook, false);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, manifest.id);
assert.equal(manifest.id, ledger.offlinePackId);
assert.equal(manifest.files.length, 939);
assert.equal(offline.manifest.bytes, 506610912);
assert.equal(offline.checks.serviceWorkerResponses, 963);
assert(Object.values(offline.checks).every((v) => v === true || v === 963));
const normal = json(c.normalVerification),
  comparison = json(c.normalComparison);
assert.equal(normal.result, 'passed');
assert.equal(normal.ruleset, ledger.ruleset);
assert.equal(normal.checkedTicks, 72000);
assert.equal(normal.roundTrips, 20);
assert.equal(normal.futureChecks, 18);
assert.equal(normal.hundredSeedInvariantGate, false);
assert.equal(comparison.result, 'passed');
assert.equal(comparison.matches.length, 20);
for (const pair of comparison.matches) {
  assert.equal(hash(pair.older), pair.olderSha256);
  assert.equal(hash(pair.newer), pair.newerSha256);
  const older = json(pair.older),
    newer = json(pair.newer);
  assert.equal(older.version, 124);
  assert.equal(newer.version, 125);
  assert.equal(newer.ruleset, ledger.ruleset);
  delete older.version;
  delete newer.version;
  delete older.ruleset;
  delete newer.ruleset;
  for (const owner of [newer.player, ...newer.otherChampions]) {
    assert.deepEqual(owner.leonaEVisuals, []);
    delete owner.leonaEVisuals;
  }
  assert.deepEqual(newer, older);
}
assert.equal(json(c.priorSourceIntegrity).result, 'passed');
assert.equal(ledger.acceptance.savedZenithHistory, true);
for (const key of [
  'sourceEVisualsIntegrated',
  'sourceEAudioIntegrated',
  'nativeBehaviorVerified',
  'completeLeonaKit',
  'hundredSeedInvariantGate',
  'fullGoalComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 125,
    ruleset: ledger.ruleset,
    unitTests: 1721,
    chromeCases: 11,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    savedZenithHistory: true,
    sourceEVisualsIntegrated: false,
    fullGoalComplete: false,
  })
);
