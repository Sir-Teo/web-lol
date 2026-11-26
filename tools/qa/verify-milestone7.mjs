/** Verify Milestone 7 source digests, ruleset fingerprint, split reference-coverage invariants, discrepancy register, offline pack closure, cohort receipts, and REA Evidence bundle receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE7_BASELINE_RULESET =
  'bf0a46cff65fb8997c4f7ad5846dffd9c308118612f39111125d1929a30ca869';

const IMMUTABLE_MILESTONE7_FILES = new Set([
  'src/simulation/champion-stats.ts',
  'docs/reference/milestone7-discrepancy-register.json',
  'docs/reference/milestone7-capture-packets.json',
  'tests/milestone7-contract.test.ts',
  'tests/milestone7-calibration-fixtures.test.ts',
  'tests/milestone7-champion-matrices.test.ts',
  'tests/milestone7-gameplay-calibration.test.ts',
  'e2e/milestone7-presentation-and-acceptance.spec.ts',
  'tools/qa/milestone7-multibrowser.playwright.config.ts',
  'tools/qa/profile-sim-worker.ts',
  'tools/qa/profile-milestone7.mjs',
  'tools/qa/run-milestone7-rea.mjs',
]);

export function verifyMilestone7(ledgerPath = 'docs/reference/milestone7-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 7, 'Expected Milestone 7 verification ledger');
  assert.equal(ledger.patch, '26.18', 'Expected Patch 26.18 baseline');
  assert.equal(ledger.snapshotVersion, 187, 'Expected schema 187 for Milestone 7');
  assert.equal(
    ledger.ruleset,
    MILESTONE7_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 7 baseline'
  );

  // Roster & split-evidence reference coverage invariants
  assert.equal(ledger.roster.distinctChampions, 10, 'Expected 10 distinct champions');
  assert.equal(ledger.roster.mirrorMatchupsInDefault5v5, 0, 'Expected zero-mirror default 5v5');
  assert.equal(
    ledger.roster.publicChampionChoices.length,
    10,
    'Expected 10 public champion choices'
  );
  assert.equal(ledger.referenceCoverage.total, 158, 'Expected 158 reference coverage entries');
  assert.equal(
    ledger.referenceCoverage.unimplemented,
    0,
    'Milestone 7 reference coverage must have zero unimplemented entries'
  );
  assert.equal(
    ledger.referenceCoverage.approximationsWithoutDeviationNote,
    0,
    'Every Milestone 7 approximation must document a player-facing deviation note'
  );
  assert.equal(
    ledger.referenceCoverage.verifiedBehavior +
      ledger.referenceCoverage.verifiedData +
      ledger.referenceCoverage.approximation +
      ledger.referenceCoverage.unimplemented,
    ledger.referenceCoverage.total,
    'Reference coverage status counts must sum to total'
  );
  for (const dimension of [
    'byImplementationEvidence',
    'byReferenceEvidence',
    'byPresentationEvidence',
  ]) {
    const sum = Object.values(ledger.referenceCoverage[dimension]).reduce((a, b) => a + b, 0);
    assert.equal(
      sum,
      ledger.referenceCoverage.total,
      `Reference coverage ${dimension} must sum to total`
    );
  }

  // Discrepancy register invariants (live file check + zero open P0/P1 implementation bugs)
  const register = JSON.parse(readFileSync(resolve(ledger.discrepancyRegister.file), 'utf8'));
  assert.equal(register.milestone, 7, 'Discrepancy register must target Milestone 7');
  assert.equal(
    register.discrepancies.length,
    ledger.discrepancyRegister.total,
    'Discrepancy count mismatch between ledger and register'
  );
  const openP0 = register.discrepancies.filter(
    (d) => d.disposition === 'open' && d.severity === 'P0'
  ).length;
  const openP1 = register.discrepancies.filter(
    (d) => d.disposition === 'open' && d.severity === 'P1'
  ).length;
  assert.equal(openP0, 0, 'Milestone 7 must have zero open P0 implementation discrepancies');
  assert.equal(openP1, 0, 'Milestone 7 must have zero open P1 implementation discrepancies');
  assert.equal(ledger.discrepancyRegister.openP0, 0);
  assert.equal(ledger.discrepancyRegister.openP1, 0);

  // Cohort verification invariants (6/6 verified natural Nexus victories on current ruleset)
  assert.equal(ledger.cohort.ruleset, ledger.ruleset, 'Cohort ruleset must match ledger ruleset');
  assert.equal(ledger.cohort.publicRosterVerified, true, 'Cohort must verify public roster');
  assert.equal(ledger.cohort.victories, ledger.cohort.seeds, 'All cohort seeds must reach victory');
  assert.equal(ledger.cohort.unfinished, 0, 'Cohort must have zero unfinished matches');
  assert.equal(ledger.cohort.completionRate, 1, 'Cohort completion rate must be 1.0');
  assert.equal(ledger.cohort.matches.length, ledger.cohort.seeds, 'Match ledger length mismatch');
  assert.equal(
    ledger.cohort.matches.reduce((acc, m) => acc + m.checkedTicks, 0),
    ledger.cohort.checkedTicks,
    'Checked tick sum mismatch'
  );

  // Multi-browser, nested-subpath, and offline closure invariants
  assert.equal(ledger.browsers.chromium.presentationAndAcceptancePassed, true);
  assert.equal(ledger.browsers.chromium.nestedSubpathPassed, true);
  assert.equal(ledger.browsers.chromium.offlinePackPassed, true);
  assert.equal(ledger.browsers.chromium.offlineCompletedMatchPassed, true);
  assert.equal(ledger.browsers.firefox.presentationAndAcceptancePassed, true);
  assert.equal(ledger.browsers.webkit.presentationAndAcceptancePassed, true);
  assert.equal(ledger.nestedSubpath.developmentHook, false);
  assert.equal(ledger.nestedSubpath.unrequestedPreloads, 0);
  assert.equal(ledger.offline.originRequestsWhileOffline, 0);
  assert.equal(ledger.offline.productionErrors, 0);
  assert.equal(ledger.offline.failedRequests, 0);
  assert.equal(ledger.offline.outsidePrefixRequests, 0);

  // Snapshot version and live ruleset verification
  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 187, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone7 = currentVersion === 187;
  if (isLiveMilestone7) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Live ruleset fingerprint drifted from Milestone 7 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone7 && !IMMUTABLE_MILESTONE7_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone7 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 7 ledger'
    );
    assert.equal(packReport.files, ledger.pack.files);
    assert.equal(packReport.bytes, ledger.pack.bytes);
    assert.equal(packReport.workerPolicySha256, ledger.pack.workerPolicySha256);
    packVerified = true;
  }

  // REA certification invariants
  assert.equal(ledger.reaCertification.releaseExposureExposedCount, 0);
  assert.equal(ledger.reaCertification.runtimeScriptsUnmatched, 0);
  assert.equal(ledger.reaCertification.runtimeScriptsAmbiguous, 0);
  assert.equal(
    ledger.reaCertification.runtimeScriptsMatched,
    ledger.reaCertification.runtimeScriptsObserved
  );

  const localArtifactsChecked = [];
  for (const artifact of ledger.localArtifacts ?? []) {
    const target = resolve(artifact.file);
    if (!existsSync(target)) continue;
    const raw = readFileSync(target);
    assert.equal(raw.length, artifact.bytes, `Local artifact size mismatch for ${artifact.file}`);
    assert.equal(
      sha256(raw),
      artifact.sha256,
      `Local artifact SHA-256 mismatch for ${artifact.file}`
    );
    if (artifact.file.endsWith('milestone7-rea-evidence-bundle.json')) {
      assert.equal(
        artifact.sha256,
        ledger.reaCertification.bundleSha256,
        'REA bundle SHA-256 mismatch with reaCertification block'
      );
      const reaBundle = JSON.parse(raw.toString('utf8'));
      assert.equal(reaBundle.records.length, ledger.reaCertification.records);
      assert.equal(reaBundle.unknowns.length, ledger.reaCertification.unknowns);
    }
    localArtifactsChecked.push(artifact.file);
  }

  return {
    result: 'passed',
    milestone: ledger.milestone,
    snapshotVersion: ledger.snapshotVersion,
    historicalSuperseded: !isLiveMilestone7,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    referenceEntries: ledger.referenceCoverage.total,
    distinctChampions: ledger.roster.distinctChampions,
    cohortSeedsVerified: ledger.cohort.seeds,
    cohortCheckedTicks: ledger.cohort.checkedTicks,
    discrepanciesFixed: ledger.discrepancyRegister.fixed,
    discrepanciesBlockedExternal: ledger.discrepancyRegister.blockedExternal,
    sourceFilesVerified: isLiveMilestone7 ? ledger.sourceDigests.length : verifiedSourceCount,
    recordedSourceFiles: ledger.sourceDigests.length,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyMilestone7(process.argv[2])));
}
