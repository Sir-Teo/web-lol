/** Read-only evidence/source integrity, not a new browser or native run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const ledger = json('docs/reference/leona/eclipse-verification.json');
function verify(pin, file = pin.file) {
  const data = readFileSync(file);
  assert.equal(data.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(data).digest('hex'), pin.sha256, file);
}
for (const pin of ledger.evidence) verify(pin);
for (const archive of ledger.earlierSourceArchives)
  for (const pin of json(archive.ledger).files) verify(pin, `${archive.frozenInputs}/${pin.file}`);
const source = json(ledger.sourceArchive);
assert.equal(source.ruleset, ledger.ruleset);
assert.equal(source.schema, 118);
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
const checks = ledger.checks;
const standard = readFileSync(checks.standard, 'utf8');
assert(standard.includes('1538 passed (1538)') && standard.includes('273 passed (273)'));
assert(standard.includes('pass 3') && standard.includes('fail 0'));
assert(readFileSync(checks.focused, 'utf8').includes('82 passed (82)'));
assert.equal(readFileSync(checks.e2eTypecheck, 'utf8'), '');
assert(readFileSync(checks.chrome, 'utf8').includes('7 passed'));
const gate = json(checks.fixtureEvidence);
assert.equal(gate.result.saved, gate.prepared.snapshot);
assert.equal(gate.result.champion, 'ashe');
assert(!gate.result.identities.includes('leona'));
assert.deepEqual(gate.errors, []);
const fixture = JSON.parse(gate.prepared.snapshot);
const owners = [fixture.player, ...fixture.otherChampions];
assert(owners.some((o) => o.leonaW !== null && o.leonaW.detonated === false));
assert(fixture.units.some((u) => u.sunlight !== null));
assert(owners.some((o) => o.damageContributors.some((c) => c.creditSourceId !== undefined)));
const production = json(checks.production);
assert.equal(production.result, 'passed');
assert.equal(production.prefix, '/nested/rift/');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
const cohort = json(checks.cohort);
assert.equal(cohort.result, 'passed');
assert.equal(cohort.ruleset, ledger.ruleset);
assert.equal(cohort.checkedTicks, 72000);
assert.equal(cohort.roundTrips, 20);
assert.equal(cohort.futureChecks, 18);
assert.equal(cohort.hundredSeedInvariantGate, false);
const comparison = json(checks.checkpointComparison);
assert.equal(comparison.matches.length, 20);
for (const pair of comparison.matches) {
  const before = json(pair.older),
    after = json(pair.newer);
  assert.equal(before.version, 117);
  assert.equal(after.version, 118);
  assert.equal(after.ruleset, ledger.ruleset);
  for (const s of [before, after]) {
    delete s.version;
    delete s.ruleset;
  }
  for (const o of [before.player, ...before.otherChampions]) assert(!Object.hasOwn(o, 'leonaW'));
  for (const o of [after.player, ...after.otherChampions]) {
    assert.equal(o.leonaW, null);
    delete o.leonaW;
  }
  assert.deepEqual(after, before);
}
assert.equal(json(checks.priorIntegrity).result, 'passed');
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativeBehaviorVerified, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 118,
    ruleset: ledger.ruleset,
    unitTests: 1538,
    chromeCases: 7,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    completeLeonaKit: false,
    nativeBehaviorVerified: false,
  })
);
