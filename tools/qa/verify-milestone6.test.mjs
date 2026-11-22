import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone6 } from './verify-milestone6.mjs';

test('Milestone 6 verifier accepts canonical ledger, schema 185 ruleset, 158-entry coverage, and REA receipts', () => {
  const result = verifyMilestone6();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 6);
  assert.equal(result.snapshotVersion, 185);
  assert.equal(result.ruleset, 'e5e3cc7f70fae406cd8bf03ba5a5a90fc7dc87ab2e931ad190b5fe099897cad0');
  assert.equal(result.referenceEntries, 158);
  assert.equal(result.distinctChampions, 10);
  assert.equal(result.recordedSourceFiles, 23);
  assert.ok(result.sourceFilesVerified >= 15);
  assert.equal(result.reaRecords, 12);
});

test('Milestone 6 verifier fails closed on ruleset drift, unimplemented reference entries, or tampered sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm6-verify-'));
  try {
    const base = JSON.parse(readFileSync('docs/reference/milestone6-verification.json', 'utf8'));

    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone6(rulesetPath), /Ruleset fingerprint/);

    const badCoverage = structuredClone(base);
    badCoverage.referenceCoverage.unimplemented = 1;
    const coveragePath = join(dir, 'bad-coverage.json');
    writeFileSync(coveragePath, JSON.stringify(badCoverage));
    assert.throws(() => verifyMilestone6(coveragePath), /zero unimplemented/);

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find((e) => e.file === 'src/content/role-quests.ts') ??
      badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone6(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
