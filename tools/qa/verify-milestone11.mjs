/** Verify Milestone 11 source digests, schema 190 ruleset fingerprint, simulation speedup & runtime budgets, full 100-seed 60-minute public-roster cohort (closing M7-D012), bit-exact 8-seed original-lineup cohort, 3-browser acceptance (Chrome 157, Firefox 155, WebKit 26.6) including cross-browser offline completed-match restore, nested subpath & offline pack closure, CI milestone gates, and REA 6.10.1 Evidence receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE11_BASELINE_RULESET =
  '578c93f0c76c1740a83fb7617b08563944ecf406bc06902ccdc6739c9347f326';

const MILESTONE7_PUBLIC_PARITY_TICKS = new Map([
  [26018, 129896],
  [719, 151378],
  [1, 106852],
  [927, 135885],
  [2, 121660],
  [3, 112171],
]);

const MILESTONE10_ORIGINAL_PARITY_TICKS = new Map([
  [1, { winner: 'blue', finalTick: 144276 }],
  [2, { winner: 'red', finalTick: 145534 }],
  [3, { winner: 'red', finalTick: 139619 }],
  [4, { winner: 'red', finalTick: 149744 }],
  [5, { winner: 'blue', finalTick: 112358 }],
  [6, { winner: 'red', finalTick: 149434 }],
  [7, { winner: 'red', finalTick: 141332 }],
  [8, { winner: 'blue', finalTick: 136636 }],
]);

const IMMUTABLE_MILESTONE11_FILES = new Set([
  'tests/milestone11-release-readiness.test.ts',
  'tools/qa/milestone11-multibrowser.playwright.config.ts',
  'tools/qa/milestone11-macos-safari.mjs',
  'tools/qa/run-milestone11-rea.mjs',
  'tools/qa/verify-milestone11.mjs',
  'tools/qa/verify-milestone11.test.mjs',
  'docs/reference/578c93-public-milestone11-hundred-ledger.json',
]);

export function verifyMilestone11(ledgerPath = 'docs/reference/milestone11-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 11, 'Expected Milestone 11 verification ledger');
  assert.equal(ledger.patch, '26.18', 'Expected Patch 26.18 baseline');
  assert.equal(ledger.snapshotVersion, 190, 'Expected schema 190 for Milestone 11');
  assert.equal(
    ledger.ruleset,
    MILESTONE11_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 11 baseline'
  );

  // Simulation engine speedup, runtime performance & JS heap budgets
  const perf = ledger.performance;
  assert.equal(perf.withinSimulationP95Budget, true, 'Simulation p95 must be within budget');
  assert.ok(
    perf.simulationP95MsPerTick <= perf.simulationP95BudgetMs,
    `Simulation p95 (${perf.simulationP95MsPerTick} ms) exceeds budget (${perf.simulationP95BudgetMs} ms)`
  );
  assert.ok(
    perf.simulationP95MsPerTick <= 1.0,
    `Expected Milestone 11 optimized simulation p95 <= 1.0 ms/tick, got ${perf.simulationP95MsPerTick}`
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

  // Full 100-seed 60-minute public-roster cohort (closes M7-D012)
  const pub = ledger.publicHundredCohort;
  assert.equal(pub.ruleset, ledger.ruleset, '100-seed cohort ruleset must match ledger ruleset');
  assert.equal(pub.publicRosterVerified, true, '100-seed cohort must verify 10-champion roster');
  assert.equal(pub.hundredSeedInvariantGate, true, '100-seed invariant gate must pass');
  assert.equal(pub.milestone7CohortGatePassed, true, 'Milestone 7 cohort gate must pass');
  assert.equal(pub.seeds, 100, 'Expected 100 seeds in Milestone 11 public cohort');
  assert.ok(pub.victories >= 98, `Expected >= 98/100 natural victories, got ${pub.victories}`);
  assert.equal(pub.victories + pub.unfinished, pub.seeds, 'Victory + unfinished count mismatch');
  assert.equal(pub.failures, 0, '100-seed cohort must have zero failures');
  assert.ok(pub.completionRate >= 0.98, '100-seed completion rate must be >= 0.98');
  assert.ok(existsSync(resolve(pub.ledgerFile)), `Missing committed 100-seed ledger ${pub.ledgerFile}`);
  const hundredRaw = readFileSync(resolve(pub.ledgerFile));
  assert.equal(hundredRaw.length, pub.ledgerBytes, '100-seed ledger byte size mismatch');
  assert.equal(sha256(hundredRaw), pub.ledgerSha256, '100-seed ledger SHA-256 mismatch');
  const hundredLedger = JSON.parse(hundredRaw.toString('utf8'));
  assert.equal(hundredLedger.result, 'passed');
  assert.equal(hundredLedger.ruleset, ledger.ruleset);
  assert.equal(hundredLedger.seeds, 100);
  assert.equal(hundredLedger.victories, pub.victories);
  assert.equal(hundredLedger.unfinished, pub.unfinished);
  assert.equal(hundredLedger.checkedTicks, pub.checkedTicks);
  assert.equal(hundredLedger.roundTrips, pub.roundTrips);
  assert.equal(hundredLedger.futureChecks, pub.futureChecks);
  assert.equal(hundredLedger.seedLedger.length, 100);
  assert.equal(
    hundredLedger.seedLedger.reduce((acc, m) => acc + m.checkedTicks, 0),
    pub.checkedTicks,
    '100-seed checked tick sum mismatch'
  );
  const pubBlueWins = hundredLedger.seedLedger.filter((m) => m.winner === 'blue').length;
  const pubRedWins = hundredLedger.seedLedger.filter((m) => m.winner === 'red').length;
  assert.equal(pub.blueWins, pubBlueWins, '100-seed blueWins mismatch');
  assert.equal(pub.redWins, pubRedWins, '100-seed redWins mismatch');
  assert.equal(pubBlueWins + pubRedWins, pub.victories);
  for (const [seed, expectedTick] of MILESTONE7_PUBLIC_PARITY_TICKS) {
    const match = hundredLedger.seedLedger.find((m) => m.seed === seed);
    assert.ok(match, `Missing Milestone 7 parity seed ${seed} in 100-seed cohort`);
    assert.equal(
      match.finalTick,
      expectedTick,
      `Public seed ${seed} tick drifted from Milestone 7/9/10 baseline (${match.finalTick} !== ${expectedTick})`
    );
  }

  // Calibrated 8-seed original-lineup cohort (bit-exact parity with Milestone 10)
  const orig = ledger.originalCohort;
  assert.equal(orig.ruleset, ledger.ruleset, 'Original cohort ruleset must match ledger ruleset');
  assert.equal(orig.originalLineupVerified, true, 'Original cohort must verify original lineup');
  assert.equal(orig.seeds, 8, 'Expected 8-seed calibrated original-lineup cohort');
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
  assert.ok(
    origBlueWins >= 2 && origRedWins >= 2,
    `Original lineup balance regression: Blue ${origBlueWins} - Red ${origRedWins}`
  );
  for (const [seed, expected] of MILESTONE10_ORIGINAL_PARITY_TICKS) {
    const match = orig.matches.find((m) => m.seed === seed);
    assert.ok(match, `Missing original-lineup seed ${seed}`);
    assert.equal(
      match.finalTick,
      expected.finalTick,
      `Original seed ${seed} tick drifted from Milestone 10 (${match.finalTick} !== ${expected.finalTick})`
    );
    assert.equal(
      match.winner,
      expected.winner,
      `Original seed ${seed} winner drifted from Milestone 10 (${match.winner} !== ${expected.winner})`
    );
  }

  // Nested subpath, offline pack, and full 3-browser acceptance (Chrome, Firefox, WebKit)
  assert.equal(ledger.nestedSubpath.result, 'passed');
  assert.equal(ledger.nestedSubpath.developmentHook, false);
  assert.equal(ledger.nestedSubpath.unrequestedPreloads, 0);
  assert.equal(ledger.nestedSubpath.publicChampionChoices, 10);
  assert.equal(ledger.offline.result, 'passed');
  assert.equal(ledger.offline.packId, ledger.pack.id);
  assert.equal(ledger.offline.productionErrors, 0);
  assert.ok(ledger.offline.serviceWorkerResponses >= 1400);

  for (const engine of ['chromium', 'firefox', 'webkit']) {
    const b = ledger.browsers[engine];
    assert.ok(b, `Missing browser acceptance record for ${engine}`);
    assert.equal(b.controlsAndAccessibilityPassed, true, `${engine} controls/accessibility E2E must pass`);
    assert.equal(b.presentationAndAcceptancePassed, true, `${engine} presentation/acceptance E2E must pass`);
    assert.equal(
      b.tenSequentialRestartsAndContextLossPassed,
      true,
      `${engine} 10-restart & context-loss E2E must pass`
    );
    assert.equal(
      b.offlineCompletedMatchPassed,
      true,
      `${engine} offline completed-match restore must pass`
    );
    assert.equal(
      b.offlineCompletedOriginRequests,
      0,
      `${engine} offline restore must make zero origin requests`
    );
    assert.ok(
      b.offlineCompletedServiceWorkerResponses >= 1500,
      `${engine} offline restore expected >= 1500 SW responses`
    );
  }

  assert.equal(
    ledger.externalGates.hundredSeedSixtyMinuteCohort,
    'closed-in-milestone-11',
    'M7-D012 100-seed scale cohort must be marked closed-in-milestone-11'
  );
  assert.equal(ledger.externalGates.nativeRiotClientCaptures, 'blocked-external');
  assert.equal(ledger.externalGates.integratedGpuLaptopAndDesktop20MinPostWarmup, 'blocked-external');
  assert.equal(ledger.externalGates.macosDesktopSafariAcceptance, 'blocked-external');
  assert.equal(ledger.externalGates.twentyHumanInputFullMatches, 'blocked-external');
  assert.ok(
    existsSync(resolve('tools/qa/milestone11-macos-safari.mjs')),
    'Missing fail-closed macOS Safari release-gate runner'
  );

  const ciWorkflowPath = resolve('.github/workflows/milestone-gates.yml');
  assert.ok(existsSync(ciWorkflowPath), 'Missing .github/workflows/milestone-gates.yml');
  const ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');
  assert.match(ciWorkflow, /verify-milestone11\.mjs/, 'CI workflow must invoke verify-milestone11');
  assert.match(
    ciWorkflow,
    /milestone11-release-readiness\.test\.ts/,
    'CI workflow must run milestone11-release-readiness.test.ts'
  );

  // Snapshot version and live ruleset verification
  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 190, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone11 = currentVersion === 190;
  if (isLiveMilestone11) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Live ruleset fingerprint drifted from Milestone 11 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone11 && !IMMUTABLE_MILESTONE11_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone11 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 11 ledger'
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
    if (artifact.file.endsWith('milestone11-rea-evidence-bundle.json')) {
      assert.equal(
        artifact.sha256,
        ledger.reaCertification.bundleSha256,
        'REA bundle SHA-256 mismatch with reaCertification block'
      );
      const reaBundle = JSON.parse(raw.toString('utf8'));
      assert.equal(reaBundle.records.length, ledger.reaCertification.records);
      assert.equal(reaBundle.unknowns.length, ledger.reaCertification.unknowns);
    }
    if (artifact.file.endsWith('milestone11-performance-profile.json')) {
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
    historicalSuperseded: !isLiveMilestone11,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    simulationP95MsPerTick: perf.simulationP95MsPerTick,
    postGcUsedJsHeapMiB: perf.postGcUsedJsHeapMiB,
    drawCallsP95: perf.drawCallsP95,
    publicHundredSeedsVerified: pub.seeds,
    publicHundredVictories: pub.victories,
    publicHundredCheckedTicks: pub.checkedTicks,
    originalCohortSeedsVerified: orig.seeds,
    originalCohortBlueWins: origBlueWins,
    originalCohortRedWins: origRedWins,
    browsersVerified: ['chromium', 'firefox', 'webkit'],
    sourceFilesVerified: isLiveMilestone11 ? ledger.sourceDigests.length : verifiedSourceCount,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(verifyMilestone11(process.argv[2]), null, 2));
}
