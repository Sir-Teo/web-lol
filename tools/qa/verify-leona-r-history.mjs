/** Frozen saved-history and delivery checks; no native R acceptance implied. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  text = (p) => readFileSync(p, 'utf8'),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-history-verification.json'),
  archive = json(ledger.sourceArchive),
  source = archive.files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
assert.equal(archive.snapshotSchema, 126);
assert.equal(archive.ruleset, ledger.ruleset);
const frozen = (p) => source.find((r) => r.file === p).archived,
  bounds = json(frozen('src/content/leona-r-history-bounds.json')),
  c = ledger.checks;
assert.equal(bounds.sourcePinSha256, hash(frozen('docs/reference/leona-r-particles.json')));
assert.equal(bounds.records.length, 44);
assert.deepEqual(bounds.bounds, {
  buff: 722,
  cast: 698,
  contact: 132,
  area: 704,
  impact: 884,
  history: 884,
  sourceWindow: 885,
});
assert.deepEqual(json(c.bounds).bounds, bounds.bounds);
assert.match(text(c.standard), /1827 passed \(1827\)/);
assert.match(text(c.standard), /301 passed \(301\)/);
assert.match(text(c.standard), /pass 3/);
assert.equal(text(c.e2eTypecheck), '');
assert.match(text(c.browser), /14 passed/);
const phases = new Set();
for (const file of c.browserEvidence) {
  const r = json(file);
  phases.add(r.phase);
  assert.equal(r.prepared.rejected, true);
  assert.equal(r.prepared.history.startTick, r.prepared.startTick);
  assert.equal(r.prepared.saved, r.result.saved);
  assert.equal(r.prepared.future, r.result.future);
  assert.deepEqual(r.prepared.history, r.result.history);
  assert.deepEqual(r.errors, []);
  const saved = JSON.parse(r.result.saved);
  assert.equal(saved.version, 126);
  assert.equal(saved.ruleset, ledger.ruleset);
  if (r.phase === 'windup') assert.equal(r.result.history.release, null);
  if (r.phase === 'released') assert(r.result.history.release);
  if (r.phase === 'impact') assert.equal(r.result.history.impact.contacts.length, 1);
}
assert.deepEqual([...phases].sort(), ['impact', 'released', 'windup']);
const production = text(c.production)
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
assert.equal(pack.files.length, 996);
assert.equal(pack.bytes, 510463898);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const [key, value] of Object.entries(offline.checks)) {
  if (key === 'serviceWorkerResponses') assert.equal(value, 963);
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
  assert.equal(older.version, 125);
  assert.equal(newer.version, 126);
  assert.equal(newer.ruleset, ledger.ruleset);
  delete older.version;
  delete newer.version;
  delete older.ruleset;
  delete newer.ruleset;
  for (const owner of [newer.player, ...newer.otherChampions]) {
    assert.deepEqual(owner.leonaRVisuals, []);
    delete owner.leonaRVisuals;
  }
  assert.deepEqual(newer, older);
}
assert.equal(ledger.acceptance.savedSolarHistory, true);
for (const key of [
  'sourceRVisualsIntegrated',
  'sourceRAudioIntegrated',
  'nativeBehaviorVerified',
  'fullGoalComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 126,
    ruleset: ledger.ruleset,
    unitTests: 1827,
    chromeCases: 14,
    normalSmokeTicks: 72000,
    savedSolarHistory: true,
    sourceRVisualsIntegrated: false,
  })
);
