import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone5 } from './verify-milestone5.mjs';

test('Milestone 5 verifier accepts canonical ledger and immutable Milestone 5 sources', () => {
  const result = verifyMilestone5();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 5);
  assert.equal(result.snapshotVersion, 184);
  assert.equal(result.ruleset, '1cf6e4e9b814a10bcd727579afc7485af55df0f870b7deed6cfdaadb58989ce7');
  assert.equal(result.recordedSourceFiles, 21);
  assert.ok(result.sourceFilesVerified >= 5);
  assert.equal(result.reaRecords, 14);
});

test('Milestone 5 verifier rejects tampered source digest or ruleset drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm5-verify-'));
  try {
    const base = JSON.parse(readFileSync('docs/reference/milestone5-verification.json', 'utf8'));
    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone5(rulesetPath), /SNAPSHOT_RULESET|Ruleset fingerprint/);

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find((e) => e.file === 'src/storage/sound-preference.ts') ??
      badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone5(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
