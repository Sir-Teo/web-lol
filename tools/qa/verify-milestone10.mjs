/** Verify Milestone 10 source digests, schema 189 ruleset fingerprint, player controls/accessibility contract, runtime performance & JS heap budgets, calibrated 8-seed original-lineup + 6-seed public-roster parity cohorts, nested subpath & offline pack closure, CI milestone gates, and REA 6.10.1 Evidence receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE10_BASELINE_RULESET =
  'c1e9395085d05e5450340fac5433787d3bac9b05b8d675e6b43efa8a8b334341';

const MILESTONE7_PUBLIC_PARITY_TICKS = new Map([
  [26018, 129896],
  [719, 151378],
  [1, 106852],
  [927, 135885],
  [2, 121660],
  [3, 112171],
]);

const ORIGINAL_LINEUP_CALIBRATED_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const IMMUTABLE_MILESTONE10_FILES = new Set([
  'tests/milestone10-controls-accessibility.test.ts',
  'e2e/milestone10-controls-and-accessibility.spec.ts',
  'tools/qa/run-milestone10-rea.mjs',
  'tools/qa/verify-milestone10.mjs',
  'tools/qa/verify-milestone10.test.mjs',
]);

export function verifyMilestone10(ledgerPath = 'docs/reference/milestone10-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 10, 'Expected Milestone 10 verification ledger');
  assert.equal(ledger.patch, '26.18', 'Expected Patch 26.18 baseline');
  assert.equal(ledger.snapshotVersion, 189, 'Expected schema 189 for Milestone 10');
  assert.equal(
    ledger.ruleset,
    MILESTONE10_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 10 baseline'
  );

  // Player controls, rebinding, and accessibility contract
  const controls = ledger.controlsAndAccessibility;
  assert.equal(controls.storageKey, 'rift.player-settings.v1');
  assert.deepEqual(controls.castModes, ['normal', 'quick', 'quick-indicator']);
  assert.deepEqual(controls.attackMoveModes, ['click', 'quick']);
  assert.deepEqual(controls.targetChampionsOnlyModes, ['hold', 'toggle']);
  assert.deepEqual(controls.colorVisionModes, [
    'default',
    'deuteranopia',
    'protanopia',
    'tritanopia',
    'high-contrast',
  ]);
  assert.deepEqual(controls.hudScales, [0.85, 1, 1.15, 1.25]);
  assert.deepEqual(controls.textScales, [0.9, 1, 1.15, 1.3]);
  assert.equal(controls.rebindableActionCount, 20);
  assert.equal(controls.reducedMotionSupported, true);
  assert.equal(controls.selfCastModifierSupported, true);
  assert.ok(controls.unitTestsPassed >= 6, 'Expected at least 6 Milestone 10 unit tests passing');
  assert.equal(controls.e2ePassed, true, 'Controls & accessibility E2E spec must pass');

  // Performance & JS heap budgets preserved on schema 189
  const perf = ledger.performance;
  assert.equal(perf.withinSimulationP95Budget, true, 'Simulation p95 must be within budget');
  assert.ok(
    perf.simulationP95MsPerTick <= perf.simulationP95BudgetMs,
    `Simulation p95 (${perf.simulationP95MsPerTick} ms) exceeds budget (${perf.simulationP95BudgetMs} ms)`
  );
  assert.equal(perf.withinHeapBudget, true, 'Post-GC JS heap must be within budget');
  assert.ok(
    perf.postGcUsedJsHeapMiB <= perf.postGcHeapBudgetMiB,
    `Post-GC JS heap (${perf.postGcUsedJsHeapMiB} MiB) exceeds budget (${perf.postGcHeapBudgetMiB} MiB)`
  );
  assert.equal(perf.withinDrawCallBudget, true, 'Draw calls p95 must be within budget');
  assert.ok(
    perf.drawCallsP95 <= perf.drawCallsBudget,
    `Draw calls p95 (${perf.drawCallsP95}) exceeds budget (${perf.drawCallsBudget})`
  );
  assert.equal(perf.developmentHookPresent, false, 'Production profile must not expose dev hook');
  assert.equal(perf.pageErrors, 0, 'Production profile must have zero page errors');

  // Calibrated 8-seed original-lineup 5v5 balance cohort
  const orig = ledger.originalCohort;
  assert.equal(orig.ruleset, ledger.ruleset, 'Original cohort ruleset must match ledger ruleset');
  assert.equal(orig.originalLineupVerified, true, 'Original cohort must verify original lineup');
  assert.equal(orig.seeds, 8, 'Expected 8-seed calibrated original-lineup cohort for Milestone 10');
  assert.equal(orig.victories, orig.seeds, 'All original cohort seeds must reach natural victory');
  assert.equal(orig.unfinished, 0, 'Original cohort must have zero unfinished matches');
  assert.equal(orig.failures, 0, 'Original cohort must have zero failures');
  assert.equal(orig.completionRate, 1, 'Original cohort completion rate must be 1.0');
  assert.equal(orig.matches.length, orig.seeds, 'Original cohort match ledger length mismatch');
  assert.equal(
    orig.matches.reduce((acc, m) => acc + m.checkedTicks, 0),
    orig.checkedTicks,
    'Original cohort checked tick sum mismatch'
  );
  const origBlueWins = orig.matches.filter((m) => m.winner === 'blue').length;
  const origRedWins = orig.matches.filter((m) => m.winner === 'red').length;
  assert.equal(orig.blueWins, origBlueWins, 'Original cohort blueWins count mismatch');
  assert.equal(orig.redWins, origRedWins, 'Original cohort redWins count mismatch');
  assert.equal(origBlueWins + origRedWins, orig.seeds);
  assert.ok(
    origBlueWins >= 2 && origRedWins >= 2,
    `Original lineup balance regression: Blue ${origBlueWins} - Red ${origRedWins} (expected competitive split >= 2 wins each side)`
  );
  for (const seed of ORIGINAL_LINEUP_CALIBRATED_SEEDS) {
    assert.ok(
      orig.matches.some((m) => m.seed === seed),
      `Missing original-lineup calibration seed ${seed}`
    );
  }

  // 6-seed public-roster parity cohort (bit-exact tick parity with Milestone 7 & 9)
  const pub = ledger.publicCohort;
  assert.equal(pub.ruleset, ledger.ruleset, 'Public cohort ruleset must match ledger ruleset');
  assert.equal(pub.publicRosterVerified, true, 'Public cohort must verify 10-champion roster');
  assert.equal(pub.seeds, 6, 'Expected 6-seed public parity cohort for Milestone 10');
  assert.equal(pub.victories, pub.seeds, 'All public cohort seeds must reach natural victory');
  assert.equal(pub.unfinished, 0, 'Public cohort must have zero unfinished matches');
  assert.equal(pub.failures, 0, 'Public cohort must have zero failures');
  assert.equal(pub.completionRate, 1, 'Public cohort completion rate must be 1.0');
  assert.equal(pub.matches.length, pub.seeds, 'Public cohort match ledger length mismatch');
  assert.equal(
    pub.matches.reduce((acc, m) => acc + m.checkedTicks, 0),
    pub.checkedTicks,
    'Public cohort checked tick sum mismatch'
  );
  for (const [seed, expectedTick] of MILESTONE7_PUBLIC_PARITY_TICKS) {
    const match = pub.matches.find((m) => m.seed === seed);
    assert.ok(match, `Missing Milestone 7 parity seed ${seed} in public cohort`);
    assert.equal(
      match.finalTick,
      expectedTick,
      `Public seed ${seed} tick drifted from Milestone 7/9 baseline (${match.finalTick} !== ${expectedTick})`
    );
  }

  // Nested subpath, offline pack, browser acceptance, and CI workflow gates
  assert.equal(ledger.nestedSubpath.result, 'passed');
  assert.equal(ledger.nestedSubpath.developmentHook, false);
  assert.equal(ledger.nestedSubpath.unrequestedPreloads, 0);
  assert.equal(ledger.nestedSubpath.publicChampionChoices, 10);
  assert.equal(ledger.offline.result, 'passed');
  assert.equal(ledger.offline.packId, ledger.pack.id);
  assert.equal(ledger.offline.productionErrors, 0);
  assert.ok(ledger.offline.serviceWorkerResponses >= 1400);
  assert.equal(ledger.browsers.chromium.controlsAndAccessibilityPassed, true);
  assert.equal(ledger.browsers.chromium.presentationAndAcceptancePassed, true);
  assert.equal(ledger.browsers.chromium.tenSequentialRestartsAndContextLossPassed, true);

  const ciWorkflowPath = resolve('.github/workflows/milestone-gates.yml');
  assert.ok(existsSync(ciWorkflowPath), 'Missing .github/workflows/milestone-gates.yml');
  const ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');
  assert.match(ciWorkflow, /verify-milestone10\.mjs/, 'CI workflow must invoke verify-milestone10');

  // Snapshot version and live ruleset verification
  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 189, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone10 = currentVersion === 189;
  if (isLiveMilestone10) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Live ruleset fingerprint drifted from Milestone 10 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone10 && !IMMUTABLE_MILESTONE10_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone10 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 10 ledger'
    );
    assert.equal(packReport.files, ledger.pack.files);
    assert.equal(packReport.bytes, ledger.pack.bytes);
    assert.equal(packReport.workerPolicySha256, ledger.pack.workerPolicySha256);
    packVerified = true;
  }

  // REA 6.10.1 certification invariants
  assert.equal(ledger.reaCertification.releaseExposureExposedCount, 0);
  assert.equal(ledger.reaCertification.runtimeScriptsUnmatched, 0);
  assert.equal(ledger.reaCertification.runtimeScriptsAmbiguous, 0);
  assert.equal(
    ledger.reaCertification.runtimeScriptsMatched,
    ledger.reaCertification.runtimeScriptsObserved
  );
  assert.equal(ledger.reaCertification.unknowns, 0);
  assert.ok(ledger.reaCertification.records >= 2);

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
    if (artifact.file.endsWith('milestone10-rea-evidence-bundle.json')) {
      assert.equal(
        artifact.sha256,
        ledger.reaCertification.bundleSha256,
        'REA bundle SHA-256 mismatch with reaCertification block'
      );
      const reaBundle = JSON.parse(raw.toString('utf8'));
      assert.equal(reaBundle.records.length, ledger.reaCertification.records);
      assert.equal(reaBundle.unknowns.length, ledger.reaCertification.unknowns);
    }
    if (artifact.file.endsWith('milestone10-performance-profile.json')) {
      const profile = JSON.parse(raw.toString('utf8'));
      assert.equal(profile.ruleset, ledger.ruleset);
      assert.equal(profile.simulation.withinSimulationP95Budget, true);
      assert.equal(profile.browserProduction.budgets.withinHeapBudget, true);
      assert.equal(profile.browserProduction.budgets.withinDrawCallBudget, true);
    }
    localArtifactsChecked.push(artifact.file);
  }

  return {
    result: 'passed',
    milestone: ledger.milestone,
    snapshotVersion: ledger.snapshotVersion,
    historicalSuperseded: !isLiveMilestone10,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    simulationP95MsPerTick: perf.simulationP95MsPerTick,
    postGcUsedJsHeapMiB: perf.postGcUsedJsHeapMiB,
    drawCallsP95: perf.drawCallsP95,
    originalCohortSeedsVerified: orig.seeds,
    originalCohortBlueWins: origBlueWins,
    originalCohortRedWins: origRedWins,
    originalCohortCheckedTicks: orig.checkedTicks,
    publicCohortSeedsVerified: pub.seeds,
    publicCohortCheckedTicks: pub.checkedTicks,
    sourceFilesVerified: isLiveMilestone10 ? ledger.sourceDigests.length : verifiedSourceCount,
    recordedSourceFiles: ledger.sourceDigests.length,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyMilestone10(process.argv[2])));
}
