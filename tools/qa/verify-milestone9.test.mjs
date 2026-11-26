import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone9 } from './verify-milestone9.mjs';

test('Milestone 9 verifier accepts canonical schema-188 ledger, budgets, 12-seed public + 4-seed original cohorts, and REA receipts', () => {
  const result = verifyMilestone9();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 9);
  assert.equal(result.snapshotVersion, 188);
  assert.equal(result.ruleset, '878d8aaf2b241c5b515b21c68ee3efb33e35ceeae4b5e442240e2deb1c6e76a2');
  assert.ok(result.simulationP95MsPerTick <= 4.0);
  assert.ok(result.postGcUsedJsHeapMiB <= 280);
  assert.ok(result.drawCallsP95 <= 250);
  assert.equal(result.publicCohortSeedsVerified, 12);
  assert.equal(result.originalCohortSeedsVerified, 4);
  assert.ok(result.sourceFilesVerified >= 3);
  assert.equal(result.reaRecords, 2);
});

test('Milestone 9 verifier fails closed on ruleset drift, budget regressions, tick drift, cohort failure, REA mismatch, or tampered sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm9-verify-'));
  try {
    const base = JSON.parse(readFileSync('docs/reference/milestone9-verification.json', 'utf8'));

    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone9(rulesetPath), /Ruleset fingerprint/);

    const badSimBudget = structuredClone(base);
    badSimBudget.performance.simulationP95MsPerTick = 4.25;
    const simPath = join(dir, 'bad-sim.json');
    writeFileSync(simPath, JSON.stringify(badSimBudget));
    assert.throws(() => verifyMilestone9(simPath), /Simulation p95/);

    const badHeapBudget = structuredClone(base);
    badHeapBudget.performance.postGcUsedJsHeapMiB = 285.5;
    const heapPath = join(dir, 'bad-heap.json');
    writeFileSync(heapPath, JSON.stringify(badHeapBudget));
    assert.throws(() => verifyMilestone9(heapPath), /Post-GC JS heap/);

    const badTickDrift = structuredClone(base);
    badTickDrift.publicCohort.matches[0].finalTick += 1;
    const driftPath = join(dir, 'bad-drift.json');
    writeFileSync(driftPath, JSON.stringify(badTickDrift));
    assert.throws(() => verifyMilestone9(driftPath), /drifted from Milestone 7/);

    const badCohort = structuredClone(base);
    badCohort.originalCohort.unfinished = 1;
    const cohortPath = join(dir, 'bad-cohort.json');
    writeFileSync(cohortPath, JSON.stringify(badCohort));
    assert.throws(() => verifyMilestone9(cohortPath), /zero unfinished/);

    const badRea = structuredClone(base);
    badRea.reaCertification.runtimeScriptsUnmatched = 1;
    const reaPath = join(dir, 'bad-rea.json');
    writeFileSync(reaPath, JSON.stringify(badRea));
    assert.throws(() => verifyMilestone9(reaPath));

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find(
        (e) => e.file === 'tests/milestone9-performance-and-memory.test.ts'
      ) ?? badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone9(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
