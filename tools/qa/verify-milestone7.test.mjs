import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone7 } from './verify-milestone7.mjs';

test('Milestone 7 verifier accepts canonical schema-187 ledger, ruleset, 158 split-evidence entries, 6-seed cohort, and REA receipts', () => {
  const result = verifyMilestone7();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 7);
  assert.equal(result.snapshotVersion, 187);
  assert.equal(result.ruleset, 'bf0a46cff65fb8997c4f7ad5846dffd9c308118612f39111125d1929a30ca869');
  assert.equal(result.referenceEntries, 158);
  assert.equal(result.distinctChampions, 10);
  assert.equal(result.cohortSeedsVerified, 6);
  assert.equal(result.cohortCheckedTicks, 757842);
  assert.equal(result.recordedSourceFiles, 26);
  assert.ok(result.sourceFilesVerified >= 12);
  assert.equal(result.reaRecords, 2);
});

test('Milestone 7 verifier fails closed on ruleset drift, unimplemented entries, missing deviation notes, unfinished cohort, or tampered sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm7-verify-'));
  try {
    const base = JSON.parse(readFileSync('docs/reference/milestone7-verification.json', 'utf8'));

    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone7(rulesetPath), /Ruleset fingerprint/);

    const badCoverage = structuredClone(base);
    badCoverage.referenceCoverage.unimplemented = 1;
    const coveragePath = join(dir, 'bad-coverage.json');
    writeFileSync(coveragePath, JSON.stringify(badCoverage));
    assert.throws(() => verifyMilestone7(coveragePath), /zero unimplemented/);

    const badDeviation = structuredClone(base);
    badDeviation.referenceCoverage.approximationsWithoutDeviationNote = 1;
    const deviationPath = join(dir, 'bad-deviation.json');
    writeFileSync(deviationPath, JSON.stringify(badDeviation));
    assert.throws(() => verifyMilestone7(deviationPath), /deviation note/);

    const badCohort = structuredClone(base);
    badCohort.cohort.unfinished = 1;
    const cohortPath = join(dir, 'bad-cohort.json');
    writeFileSync(cohortPath, JSON.stringify(badCohort));
    assert.throws(() => verifyMilestone7(cohortPath), /zero unfinished/);

    const badRea = structuredClone(base);
    badRea.reaCertification.runtimeScriptsUnmatched = 1;
    const reaPath = join(dir, 'bad-rea.json');
    writeFileSync(reaPath, JSON.stringify(badRea));
    assert.throws(() => verifyMilestone7(reaPath));

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find((e) => e.file === 'src/simulation/champion-stats.ts') ??
      badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone7(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
