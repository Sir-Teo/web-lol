/** Verify Milestone 9 source digests, schema 188 ruleset fingerprint, runtime performance & JS heap budgets, 12-seed public + 4-seed original-lineup scale cohorts, nested subpath & offline pack closure, and REA 6.10.1 Evidence receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE9_BASELINE_RULESET =
  '878d8aaf2b241c5b515b21c68ee3efb33e35ceeae4b5e442240e2deb1c6e76a2';

const MILESTONE7_BASELINE_TICKS = new Map([
  [26018, 129896],
  [719, 151378],
  [1, 106852],
  [927, 135885],
  [2, 121660],
  [3, 112171],
]);

const ORIGINAL_LINEUP_BASELINE_TICKS = new Map([
  [26018, 95466],
  [719, 94160],
  [1, 94150],
  [927, 93470],
]);

const IMMUTABLE_MILESTONE9_FILES = new Set([
  'tests/milestone9-performance-and-memory.test.ts',
  'tools/qa/run-milestone9-rea.mjs',
  'tools/qa/verify-milestone9.mjs',
]);

export function verifyMilestone9(ledgerPath = 'docs/reference/milestone9-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 9, 'Expected Milestone 9 verification ledger');
  assert.equal(ledger.patch, '26.18', 'Expected Patch 26.18 baseline');
  assert.equal(ledger.snapshotVersion, 188, 'Expected schema 188 for Milestone 9');
  assert.equal(
    ledger.ruleset,
    MILESTONE9_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 9 baseline'
  );

  // Performance & JS heap budgets closing M7-D013
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

  // 12-seed public roster scale cohort (including bit-exact tick parity with Milestone 7 seeds)
  const pub = ledger.publicCohort;
  assert.equal(pub.ruleset, ledger.ruleset, 'Public cohort ruleset must match ledger ruleset');
  assert.equal(pub.publicRosterVerified, true, 'Public cohort must verify 10-champion roster');
  assert.equal(pub.seeds, 12, 'Expected 12-seed public cohort for Milestone 9');
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
  for (const [seed, expectedTick] of MILESTONE7_BASELINE_TICKS) {
    const match = pub.matches.find((m) => m.seed === seed);
    assert.ok(match, `Missing Milestone 7 parity seed ${seed} in public cohort`);
    assert.equal(
      match.finalTick,
      expectedTick,
      `Seed ${seed} tick drifted from Milestone 7 baseline (${match.finalTick} !== ${expectedTick})`
    );
  }

  // 4-seed original-lineup scale cohort (including bit-exact tick parity with Milestone 8 seeds)
  const orig = ledger.originalCohort;
  assert.equal(orig.ruleset, ledger.ruleset, 'Original cohort ruleset must match ledger ruleset');
  assert.equal(orig.seeds, 4, 'Expected 4-seed original-lineup cohort for Milestone 9');
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
  for (const [seed, expectedTick] of ORIGINAL_LINEUP_BASELINE_TICKS) {
    const match = orig.matches.find((m) => m.seed === seed);
    assert.ok(match, `Missing calibrated original-lineup seed ${seed} in original cohort`);
    assert.equal(
      match.finalTick,
      expectedTick,
      `Original seed ${seed} tick drifted from calibrated baseline (${match.finalTick} !== ${expectedTick})`
    );
  }

  // Nested subpath, offline pack, and browser acceptance invariants
  assert.equal(ledger.nestedSubpath.result, 'passed');
  assert.equal(ledger.nestedSubpath.developmentHook, false);
  assert.equal(ledger.nestedSubpath.unrequestedPreloads, 0);
  assert.equal(ledger.nestedSubpath.publicChampionChoices, 10);
  assert.equal(ledger.offline.result, 'passed');
  assert.equal(ledger.offline.packId, ledger.pack.id);
  assert.equal(ledger.offline.productionErrors, 0);
  assert.ok(ledger.offline.serviceWorkerResponses >= 1400);
  assert.equal(ledger.browsers.chromium.presentationAndAcceptancePassed, true);
  assert.equal(ledger.browsers.chromium.tenSequentialRestartsAndContextLossPassed, true);

  // Snapshot version and live ruleset verification
  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 188, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone9 = currentVersion === 188;
  if (isLiveMilestone9) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Live ruleset fingerprint drifted from Milestone 9 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone9 && !IMMUTABLE_MILESTONE9_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone9 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 9 ledger'
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
    if (artifact.file.endsWith('milestone9-rea-evidence-bundle.json')) {
      assert.equal(
        artifact.sha256,
        ledger.reaCertification.bundleSha256,
        'REA bundle SHA-256 mismatch with reaCertification block'
      );
      const reaBundle = JSON.parse(raw.toString('utf8'));
      assert.equal(reaBundle.records.length, ledger.reaCertification.records);
      assert.equal(reaBundle.unknowns.length, ledger.reaCertification.unknowns);
    }
    if (artifact.file.endsWith('milestone9-performance-profile.json')) {
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
    historicalSuperseded: !isLiveMilestone9,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    simulationP95MsPerTick: perf.simulationP95MsPerTick,
    postGcUsedJsHeapMiB: perf.postGcUsedJsHeapMiB,
    drawCallsP95: perf.drawCallsP95,
    publicCohortSeedsVerified: pub.seeds,
    publicCohortCheckedTicks: pub.checkedTicks,
    originalCohortSeedsVerified: orig.seeds,
    originalCohortCheckedTicks: orig.checkedTicks,
    sourceFilesVerified: isLiveMilestone9 ? ledger.sourceDigests.length : verifiedSourceCount,
    recordedSourceFiles: ledger.sourceDigests.length,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyMilestone9(process.argv[2])));
}
