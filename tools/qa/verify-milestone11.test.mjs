import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMilestone11 } from './verify-milestone11.mjs';

test('Milestone 11 verifier accepts canonical schema-190 ledger, 100-seed public cohort, 8-seed original parity cohort, 3-browser acceptance, budgets, and REA receipts', () => {
  const result = verifyMilestone11();
  assert.equal(result.result, 'passed');
  assert.equal(result.milestone, 11);
  assert.equal(result.snapshotVersion, 190);
  assert.equal(
    result.ruleset,
    '578c93f0c76c1740a83fb7617b08563944ecf406bc06902ccdc6739c9347f326'
  );
  assert.ok(result.simulationP95MsPerTick <= 1.0);
  assert.ok(result.postGcUsedJsHeapMiB <= 280);
  assert.ok(result.drawCallsP95 <= 250);
  assert.equal(result.publicHundredSeedsVerified, 100);
  assert.equal(result.publicHundredVictories, 100);
  assert.equal(result.originalCohortSeedsVerified, 8);
  assert.equal(result.originalCohortBlueWins, 3);
  assert.equal(result.originalCohortRedWins, 5);
  assert.deepEqual(result.browsersVerified, ['chromium', 'firefox', 'webkit']);
  assert.ok(result.sourceFilesVerified >= 7);
  assert.equal(result.reaRecords, 2);
});

test('Milestone 11 verifier fails closed on ruleset drift, simulation regression, 100-seed cohort tampering, original-lineup tick drift, missing browser gate, REA mismatch, or tampered sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm11-verify-'));
  try {
    const base = JSON.parse(
      readFileSync('docs/reference/milestone11-verification.json', 'utf8')
    );

    const badRuleset = structuredClone(base);
    badRuleset.ruleset = '0'.repeat(64);
    const rulesetPath = join(dir, 'bad-ruleset.json');
    writeFileSync(rulesetPath, JSON.stringify(badRuleset));
    assert.throws(() => verifyMilestone11(rulesetPath), /Ruleset fingerprint/);

    const badSim = structuredClone(base);
    badSim.performance.simulationP95MsPerTick = 1.5;
    const simPath = join(dir, 'bad-sim.json');
    writeFileSync(simPath, JSON.stringify(badSim));
    assert.throws(() => verifyMilestone11(simPath), /optimized simulation p95/);

    const badHundred = structuredClone(base);
    badHundred.publicHundredCohort.victories = 95;
    badHundred.publicHundredCohort.unfinished = 5;
    const hundredPath = join(dir, 'bad-hundred.json');
    writeFileSync(hundredPath, JSON.stringify(badHundred));
    assert.throws(() => verifyMilestone11(hundredPath), /natural victories/);

    const badOrig = structuredClone(base);
    badOrig.originalCohort.matches[0].finalTick += 1;
    const origPath = join(dir, 'bad-orig.json');
    writeFileSync(origPath, JSON.stringify(badOrig));
    assert.throws(() => verifyMilestone11(origPath), /drifted from Milestone 10/);

    const badBrowser = structuredClone(base);
    badBrowser.browsers.webkit.offlineCompletedMatchPassed = false;
    const browserPath = join(dir, 'bad-browser.json');
    writeFileSync(browserPath, JSON.stringify(badBrowser));
    assert.throws(() => verifyMilestone11(browserPath), /webkit offline completed-match/);

    const badRea = structuredClone(base);
    badRea.reaCertification.runtimeScriptsUnmatched = 1;
    const reaPath = join(dir, 'bad-rea.json');
    writeFileSync(reaPath, JSON.stringify(badRea));
    assert.throws(() => verifyMilestone11(reaPath));

    const badSource = structuredClone(base);
    const immutableEntry =
      badSource.sourceDigests.find(
        (e) => e.file === 'tests/milestone11-release-readiness.test.ts'
      ) ?? badSource.sourceDigests[0];
    immutableEntry.sha256 = 'f'.repeat(64);
    const sourcePath = join(dir, 'bad-source.json');
    writeFileSync(sourcePath, JSON.stringify(badSource));
    assert.throws(() => verifyMilestone11(sourcePath), /SHA-256 mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
