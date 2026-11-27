import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone10 } from './verify-milestone10.mjs';

test('Milestone 10 verifier accepts canonical schema-189 ledger, controls/accessibility contract, budgets, calibrated original-lineup & public-parity cohorts, and REA receipts', () => {
  const result = verifyMilestone10();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 10);
  assert.equal(result.snapshotVersion, 189);
  assert.equal(
    result.ruleset,
    'c1e9395085d05e5450340fac5433787d3bac9b05b8d675e6b43efa8a8b334341'
  );
  assert.ok(result.simulationP95MsPerTick <= 4.0);
  assert.ok(result.postGcUsedJsHeapMiB <= 280);
  assert.ok(result.drawCallsP95 <= 250);
  assert.equal(result.originalCohortSeedsVerified, 8);
  assert.ok(result.originalCohortBlueWins >= 2 && result.originalCohortRedWins >= 2);
  assert.equal(result.publicCohortSeedsVerified, 6);
  assert.ok(result.sourceFilesVerified >= 5);
  assert.equal(result.reaRecords, 2);
});

test('Milestone 10 verifier fails closed on ruleset drift, budget regressions, original-lineup balance skew, public tick drift, controls regression, REA mismatch, or tampered sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm10-verify-'));
  try {
    const base = JSON.parse(
      readFileSync('docs/reference/milestone10-verification.json', 'utf8')
    );

    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone10(rulesetPath), /Ruleset fingerprint/);

    const badSimBudget = structuredClone(base);
    badSimBudget.performance.simulationP95MsPerTick = 4.25;
    const simPath = join(dir, 'bad-sim.json');
    writeFileSync(simPath, JSON.stringify(badSimBudget));
    assert.throws(() => verifyMilestone10(simPath), /Simulation p95/);

    const badHeapBudget = structuredClone(base);
    badHeapBudget.performance.postGcUsedJsHeapMiB = 285.5;
    const heapPath = join(dir, 'bad-heap.json');
    writeFileSync(heapPath, JSON.stringify(badHeapBudget));
    assert.throws(() => verifyMilestone10(heapPath), /Post-GC JS heap/);

    const badOrigBalance = structuredClone(base);
    for (const m of badOrigBalance.originalCohort.matches) m.winner = 'red';
    badOrigBalance.originalCohort.blueWins = 0;
    badOrigBalance.originalCohort.redWins = 8;
    const balancePath = join(dir, 'bad-balance.json');
    writeFileSync(balancePath, JSON.stringify(badOrigBalance));
    assert.throws(() => verifyMilestone10(balancePath), /Original lineup balance regression/);

    const badTickDrift = structuredClone(base);
    badTickDrift.publicCohort.matches[0].finalTick += 1;
    const driftPath = join(dir, 'bad-drift.json');
    writeFileSync(driftPath, JSON.stringify(badTickDrift));
    assert.throws(() => verifyMilestone10(driftPath), /drifted from Milestone 7\/9/);

    const badControls = structuredClone(base);
    badControls.controlsAndAccessibility.e2ePassed = false;
    const controlsPath = join(dir, 'bad-controls.json');
    writeFileSync(controlsPath, JSON.stringify(badControls));
    assert.throws(() => verifyMilestone10(controlsPath), /E2E spec must pass/);

    const badRea = structuredClone(base);
    badRea.reaCertification.runtimeScriptsUnmatched = 1;
    const reaPath = join(dir, 'bad-rea.json');
    writeFileSync(reaPath, JSON.stringify(badRea));
    assert.throws(() => verifyMilestone10(reaPath));

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find(
        (e) => e.file === 'tests/milestone10-controls-accessibility.test.ts'
      ) ?? badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone10(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
