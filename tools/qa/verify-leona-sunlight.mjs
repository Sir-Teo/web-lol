/** Read-only evidence integrity and checkpoint comparison; not a fresh native/browser run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/leona/sunlight-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
}
for (const pin of ledger.evidence) verify(pin);
for (const entry of ledger.earlierSourceArchives) {
  for (const pin of json(entry.ledger).files) verify(pin, `${entry.frozenInputs}/${pin.file}`);
}
const source = json(ledger.sourceArchive);
assert.equal(source.ruleset, ledger.ruleset);
assert.equal(source.schema, 117);
for (const pin of source.files) {
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
assert(standard.includes('1523 passed (1523)') && standard.includes('272 passed (272)'));
assert(standard.includes('pass 3') && standard.includes('fail 0'));
assert(readFileSync(ledger.checks.focused, 'utf8').includes('81 passed (81)'));
assert.equal(readFileSync(ledger.checks.e2eTypecheck, 'utf8'), '');
assert(readFileSync(ledger.checks.chrome, 'utf8').includes('7 passed'));
const gate = json(ledger.checks.fixtureEvidence);
assert.equal(gate.result.saved, gate.prepared.snapshot);
assert.equal(gate.result.champion, 'ashe');
assert(!gate.result.identities.includes('leona'));
assert.deepEqual(gate.errors, []);
const fixture = JSON.parse(gate.prepared.snapshot);
assert(fixture.units.some((u) => u.sunlight !== null));
assert(
  [fixture.player, ...fixture.otherChampions].some((o) =>
    o.damageContributors.some((c) => c.creditSourceId !== undefined)
  )
);
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
assert.equal(cohort.hundredSeedInvariantGate, false);
const comparison = json(ledger.checks.checkpointComparison);
assert.equal(comparison.matches.length, 20);
for (const pair of comparison.matches) {
  const before = json(pair.older),
    after = json(pair.newer);
  assert.equal(after.ruleset, ledger.ruleset);
  for (const s of [before, after]) {
    delete s.version;
    delete s.ruleset;
  }
  for (const unit of before.units) assert(!Object.hasOwn(unit, 'sunlight'));
  for (const unit of after.units) {
    assert.equal(unit.sunlight, null);
    delete unit.sunlight;
  }
  assert.deepEqual(after, before);
}
assert.equal(json(ledger.checks.priorIntegrity).result, 'passed');
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativeBehaviorVerified, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 117,
    ruleset: ledger.ruleset,
    unitTests: 1523,
    chromeCases: 7,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    completeLeonaKit: false,
    nativeBehaviorVerified: false,
  })
);
