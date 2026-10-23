/** Check the frozen failing corpus and the repaired, strictly decoded boundaries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const evidence = JSON.parse(readFileSync('docs/reference/cohort-save-corrections.json', 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.schema, 113);
for (const ref of evidence.files) {
  const bytes = readFileSync(ref.file);
  assert.equal(bytes.length, ref.bytes, ref.file);
  assert.equal(sha(bytes), ref.sha256, ref.file);
}
const summary = JSON.parse(readFileSync(evidence.failedCohort + '/summary.json', 'utf8'));
assert.equal(summary.completed, 8);
assert.equal(summary.failures, 2);
assert.equal(summary.queued.length, 92);
assert.deepEqual(summary.active, []);
assert.equal(summary.status, 'stopped-on-failure');
assert.equal(summary.hundredSeedInvariantGate, false);
assert.equal(summary.checkedTicks, 1555118);
assert.equal(summary.roundTrips, 434);
assert.equal(summary.futureChecks, 428);
assert.deepEqual(
  summary.results
    .filter((r) => r.outcome === 'failed')
    .map((r) => r.seed)
    .sort(),
  [3, 5]
);
const replay = JSON.parse(readFileSync('artifacts/cohort-defects-replay-verified.json', 'utf8'));
assert.equal(replay.targetRuleset, evidence.ruleset);
assert.equal(replay.sourceRuleset, summary.ruleset);
for (const item of replay.cases) {
  const bytes = readFileSync(item.boundarySnapshotPath);
  assert.equal(sha(bytes.subarray(0, -1)), item.boundarySnapshotSha256);
  const snapshot = JSON.parse(bytes);
  assert.equal(snapshot.ruleset, evidence.ruleset);
  assert.equal(snapshot.tick, item.originalTick);
  assert.equal(snapshot.winner, item.originalWinner);
  assert.equal(item.roundTripExact, true);
  assert.equal(item.futureExact, true);
  assert.equal(item.canonicalChanges.length, 1);
  if (item.seed === 3) {
    assert.match(item.canonicalChanges[0].path, /\.redBuff\.nextRegenTick$/);
    assert.equal(item.canonicalChanges[0].after, 204942);
  } else {
    assert.equal(item.seed, 5);
    assert.match(item.canonicalChanges[0].path, /\.slowUntil$/);
    assert.equal(item.canonicalChanges[0].after, 0);
    assert.equal(item.futureTicks, 120);
  }
}
assert.match(readFileSync('.cache/cohort-defects-unit.log', 'utf8'), /1457 passed/);
assert.match(readFileSync('.cache/cohort-defects-unit.log', 'utf8'), /265 passed/);
assert.match(readFileSync('.cache/cohort-defects-browser-initial.log', 'utf8'), /2 passed/);
assert.match(readFileSync('.cache/cohort-defects-browser-regression.log', 'utf8'), /14 passed/);
const production = JSON.parse(
  readFileSync('.cache/cohort-defects-production.log', 'utf8').trim().split('\n').at(-1)
);
assert.equal(production.result, 'passed');
assert.equal(production.developmentHook, false);
assert.equal(production.recordings, 32);
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    sourceCohortFailed: true,
    repairedSeeds: [3, 5],
    unitChecks: 1457,
    browserCases: 16,
    production: 'passed',
    hundredSeedGate: false,
  })
);
