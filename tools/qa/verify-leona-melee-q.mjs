/** Read-only audit of recorded evidence. Does not run a fresh match/browser/native client. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/leona/melee-q-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
}
for (const pin of ledger.evidence) verify(pin);
const sources = json(ledger.sourceArchive);
assert.equal(sources.ruleset, ledger.ruleset);
assert.equal(sources.schema, 116);
for (const pin of sources.files) {
  verify(pin, `${ledger.frozenInputs}/${pin.file}`);
  if (!historical) verify(pin);
}
for (const pin of ledger.reviewInputs) {
  verify(pin, pin.archived);
  if (!historical) verify(pin);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
for (const pin of json(ledger.cohortSourceArchive).files) verify(pin, pin.archived);
for (const pin of json(ledger.buildArchive).files) verify(pin);
const standard = readFileSync(ledger.checks.standard, 'utf8');
assert(standard.includes('1505 passed (1505)') && standard.includes('271 passed (271)'));
assert(standard.includes('pass 3') && standard.includes('fail 0'));
assert.equal(readFileSync(ledger.checks.finalTypecheck, 'utf8'), '');
assert(readFileSync(ledger.checks.chrome, 'utf8').includes('6 passed'));
assert(readFileSync(ledger.checks.fixtureGate, 'utf8').includes('1 passed'));
const gate = json(ledger.checks.fixtureEvidence);
assert.equal(gate.result.saved, gate.prepared.snapshot);
assert.equal(gate.result.champion, 'ashe');
assert(!gate.result.identities.includes('leona'));
assert.deepEqual(gate.errors, []);
const production = json(ledger.checks.production);
assert.equal(production.result, 'passed');
assert.equal(production.prefix, '/nested/rift/');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
const cohort = json(ledger.checks.cohort);
assert.equal(cohort.result, 'passed');
assert.equal(cohort.ruleset, ledger.ruleset);
assert.equal(cohort.checkedTicks, 72000);
assert.equal(cohort.roundTrips, 20);
assert.equal(cohort.futureChecks, 18);
const comparison = json(ledger.checks.checkpointComparison);
assert.equal(comparison.matches.length, 20);
for (const match of comparison.matches) {
  const before = json(match.older),
    after = json(match.newer);
  for (const state of [before, after]) {
    delete state.version;
    delete state.ruleset;
  }
  for (const owner of [before.player, ...before.otherChampions])
    assert(!Object.hasOwn(owner, 'leonaQ'));
  for (const owner of [after.player, ...after.otherChampions]) {
    assert.equal(owner.leonaQ, null);
    delete owner.leonaQ;
  }
  assert.deepEqual(after, before);
}
for (const file of ledger.checks.priorIntegrity) assert.equal(json(file).result, 'passed');
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativeBehaviorVerified, false);
assert.equal(ledger.acceptance.productionRosterExpanded, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 116,
    ruleset: ledger.ruleset,
    unitTests: 1505,
    chromeCases: 7,
    normalSmokeTicks: 72000,
    archivedInputs: sources.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    completeLeonaKit: false,
    nativeBehaviorVerified: false,
  })
);
