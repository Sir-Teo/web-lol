/**
 * Milestone 7 Fail-Closed Release Verifier.
 *
 * Verifies every locally executable Milestone 7 engineering & REA evidence artifact
 * against the active rulesetFingerprint() and current dist/ offline pack, and fails
 * closed on missing, stale, tampered, or failing local artifacts.
 *
 * With --strict-release, also fails closed if any external release gate remains open
 * (100-seed public cohort completion < 100, authorized native Patch 26.18 client captures,
 * desktop macOS Safari verification, or physical laptop/desktop GPU 60 FPS certification).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(filePath, label) {
  assert(existsSync(filePath), `Missing required ${label}: ${filePath}`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function verifyMilestone7(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const expectedRuleset = options.expectedRuleset ?? rulesetFingerprint();
  const strictRelease = options.strictRelease === true;

  const p = (rel) => resolve(root, rel);

  // 1. Discrepancy register (Milestone 7.0 + 7.2)
  const register = readJson(
    p('docs/reference/milestone7-discrepancy-register.json'),
    'Milestone 7 discrepancy register'
  );
  assert.equal(register.schema, 'milestone7-discrepancy-register-v1');
  assert.equal(register.patch, '26.18');
  assert(Array.isArray(register.items) && register.items.length >= 11);
  const EXTERNAL_REGISTER_STATUSES = new Set([
    'open-external-compute',
    'open-external-environment',
  ]);
  const openLocalP0P1 = register.items.filter(
    (item) =>
      (item.severity === 'P0' || item.severity === 'P1') &&
      item.status !== 'resolved' &&
      !EXTERNAL_REGISTER_STATUSES.has(item.status)
  );
  assert.equal(
    openLocalP0P1.length,
    0,
    `Open local P0/P1 engine discrepancies remain: ${openLocalP0P1.map((i) => i.id).join(', ')}`
  );
  const openExternalRegisterItems = register.items.filter(
    (item) =>
      (item.severity === 'P0' || item.severity === 'P1') &&
      EXTERNAL_REGISTER_STATUSES.has(item.status)
  );

  // 2. Calibration packets (Milestone 7.1)
  const calibration = readJson(
    p('artifacts/milestone7/calibration-packets.json'),
    'Milestone 7 calibration packets'
  );
  assert.equal(calibration.schema, 'milestone7-calibration-packets-v1');
  assert.equal(
    calibration.ruleset,
    expectedRuleset,
    'Calibration packets ruleset does not match current rulesetFingerprint()'
  );
  const packetIds = new Set((calibration.packets ?? []).map((pkt) => pkt.packetId));
  for (const requiredId of [
    'CAM-01',
    'MOVE-01',
    'INPUT-01',
    'ATK-01',
    'FOG-01',
    'LANE-01',
    'BASE-01',
    'MATCH-01',
  ]) {
    assert(packetIds.has(requiredId), `Missing calibration packet ${requiredId}`);
  }

  // 3. Multi-browser & multi-resolution acceptance (Milestone 7.3)
  const browsers = ['chrome', 'firefox', 'webkit'];
  const browserSummaries = {};
  for (const proj of browsers) {
    const report = readJson(
      p(`artifacts/milestone7/browser-acceptance-${proj}.json`),
      `Milestone 7 browser acceptance (${proj})`
    );
    assert.equal(report.schema, 'milestone7-browser-acceptance-v1');
    assert.equal(report.productionBundleVerified, true, `${proj} must verify production bundle`);
    assert.equal(report.auditMetrics?.total, 158, `${proj} ledger must retain 158 entries`);
    assert.equal(report.auditMetrics?.missingNotes, 0, `${proj} must have 0 undocumented approximations`);
    assert.equal(report.rosterCheck?.uniqueChampions, 10, `${proj} must verify 10 unique champions`);
    assert.equal(
      (report.pageErrors ?? []).length,
      0,
      `${proj} had uncaught page errors: ${(report.pageErrors ?? []).join('; ')}`
    );
    assert.equal(report.webglRecovery?.recovered, true, `${proj} WebGL recovery did not pass`);
    assert.equal((report.restartSamples ?? []).length, 5, `${proj} must run 5 sequential restarts`);
    const resolutions = new Set((report.layoutResults ?? []).map((r) => r.resolution));
    for (const res of ['1280x720', '1920x1080', '2560x1440']) {
      assert(resolutions.has(res), `${proj} missing resolution check ${res}`);
    }
    for (const row of report.layoutResults ?? []) {
      assert.equal(row.overflowX, false, `${proj} ${row.resolution} horizontal overflow`);
      assert.equal(row.overflowY, false, `${proj} ${row.resolution} vertical overflow`);
      assert.equal(row.canvasCovers, true, `${proj} ${row.resolution} canvas size`);
      assert.equal(row.hudInsideViewport, true, `${proj} ${row.resolution} HUD bounds`);
      assert.equal(row.minimapInsideViewport, true, `${proj} ${row.resolution} minimap bounds`);
    }
    browserSummaries[proj] = {
      browserName: report.browserName,
      resolutionsChecked: [...resolutions],
      restarts: report.restartSamples.length,
      pageErrors: report.pageErrors.length,
    };
  }
  const requiredScreenshots = [
    'artifacts/milestone7/m7-reference-audit.png',
    'artifacts/milestone7/m7-hud-1280x720.png',
    'artifacts/milestone7/m7-hud-1920x1080.png',
    'artifacts/milestone7/m7-hud-2560x1440.png',
  ];
  for (const shot of requiredScreenshots) {
    assert(existsSync(p(shot)) && statSync(p(shot)).size > 1024, `Missing/empty screenshot ${shot}`);
  }

  // 4. 20-match human-input traces (Milestone 7.4)
  const humanTraces = readJson(
    p('artifacts/milestone7/human-match-traces.json'),
    'Milestone 7 human-input match traces'
  );
  assert.equal(humanTraces.schema, 'milestone7-human-match-traces-v1');
  assert.equal(
    humanTraces.ruleset,
    expectedRuleset,
    'Human-input traces ruleset does not match current rulesetFingerprint()'
  );
  assert.equal(humanTraces.totalTraces, 20, 'Expected 20 human-input match traces (10x2)');
  assert.equal(humanTraces.championsCovered, 10, 'Expected all 10 public champions covered');
  assert.equal(humanTraces.failedTraces, 0, 'Human-input match traces had failures');

  // 5. Public-roster cohort plan & summary (Milestone 7.4)
  const cohortPlan = readJson(
    p('artifacts/milestone7/cohort/plan.json'),
    'Milestone 7 public-roster cohort plan'
  );
  const cohortSummary = readJson(
    p('artifacts/milestone7/cohort/summary.json'),
    'Milestone 7 public-roster cohort summary'
  );
  assert.equal(
    cohortPlan.ruleset,
    expectedRuleset,
    'Cohort plan ruleset does not match current rulesetFingerprint()'
  );
  assert.equal(
    cohortSummary.ruleset,
    expectedRuleset,
    'Cohort summary ruleset does not match current rulesetFingerprint()'
  );
  assert.equal(cohortPlan.developmentLeona, false, 'Cohort must not use developmentLeona');
  assert.equal(cohortPlan.developmentRoster, false, 'Cohort must not use developmentRoster');
  assert.equal(cohortPlan.qaAutomatedHumanCarry, true, 'Cohort must use public 10-champion roster');
  assert.equal(cohortSummary.failures, 0, 'Cohort has failed seeds');
  assert.equal(cohortSummary.unfinished, 0, 'Cohort has unfinished seeds');
  assert(
    Number.isInteger(cohortSummary.completed) && cohortSummary.completed >= 2,
    'Expected at least 2 verified full-match seeds in Milestone 7 cohort'
  );
  assert.equal(
    cohortSummary.victories,
    cohortSummary.completed,
    'All completed cohort seeds must reach natural victory'
  );

  // 6. Performance profile (Milestone 7.5)
  const perf = readJson(
    p('artifacts/milestone7/perf-profile.json'),
    'Milestone 7 performance profile'
  );
  assert.equal(perf.schema, 'milestone7-perf-profile-v1');
  assert.equal(
    perf.ruleset,
    expectedRuleset,
    'Performance profile ruleset does not match current rulesetFingerprint()'
  );
  assert.equal(
    perf.simulationLateMatch?.within60HzSimBudget,
    true,
    'Late-match simulation p95 tick exceeds 60 Hz budget'
  );

  // 7. REA 6.10.1 certification evidence (Milestone 7.5)
  const rea = readJson(
    p('docs/reference/milestone7-rea-evidence.json'),
    'Milestone 7 REA certification evidence'
  );
  assert.equal(rea.schema, 'milestone7-rea-evidence-v1');
  assert.equal(
    rea.ruleset,
    expectedRuleset,
    'REA evidence ruleset does not match current rulesetFingerprint()'
  );
  assert(
    typeof rea.reaPackage === 'string' && rea.reaPackage.startsWith('rea-agents@'),
    'REA package version missing'
  );
  assert(Array.isArray(rea.evidenceBundles) && rea.evidenceBundles.length >= 3);
  for (const bundle of rea.evidenceBundles) {
    assert(typeof bundle.evidenceId === 'string' && bundle.evidenceId.length > 0);
    assert(typeof bundle.artifactPath === 'string' && existsSync(p(bundle.artifactPath)));
    assert.equal(
      sha256File(p(bundle.artifactPath)),
      bundle.sha256,
      `REA artifact digest mismatch for ${bundle.artifactPath}`
    );
  }

  // 8. External environment release gates (honest, never fabricated)
  const openExternalGates = [];
  if (cohortSummary.completed < 100) {
    openExternalGates.push({
      gate: '100-seed-public-cohort',
      status: 'open-external-compute',
      detail: `${cohortSummary.completed}/100 verified full 60-minute public-roster seeds on 2-vCPU host`,
    });
  }
  if (calibration.nativeClientComparisonStatus !== 'verified') {
    openExternalGates.push({
      gate: 'authorized-riot-26.18-client-captures',
      status: 'open-external-environment',
      detail: 'No authorized Riot Patch 26.18 client installed in this container',
    });
  }
  if (rea.externalGates?.macosSafariVerified !== true) {
    openExternalGates.push({
      gate: 'desktop-macos-safari',
      status: 'open-external-environment',
      detail: 'Verified Linux WebKit 26.6 + Chrome + Firefox; physical macOS Safari requires macOS host',
    });
  }
  if (perf.environment?.physicalGpuPerfVerified !== true) {
    openExternalGates.push({
      gate: 'physical-gpu-60fps-certification',
      status: 'open-external-environment',
      detail: 'Headless Linux SwiftShader software WebGL only; physical laptop/desktop GPU required',
    });
  }

  const summary = {
    result: strictRelease && openExternalGates.length > 0 ? 'failed-external-gates' : 'passed-local-engineering',
    strictRelease,
    ruleset: expectedRuleset,
    openLocalP0P1Discrepancies: 0,
    openExternalDiscrepancyIds: openExternalRegisterItems.map((i) => i.id),
    calibrationPackets: calibration.packets.length,
    browsersVerified: browserSummaries,
    humanMatchTraces: {
      total: humanTraces.totalTraces,
      failed: humanTraces.failedTraces,
    },
    cohort: {
      completedSeeds: cohortSummary.completed,
      victories: cohortSummary.victories,
      failedSeeds: cohortSummary.failures,
      targetSeeds: 100,
    },
    perf: {
      p50Ms: perf.simulationLateMatch.p50Ms,
      p95Ms: perf.simulationLateMatch.p95Ms,
      p99Ms: perf.simulationLateMatch.p99Ms,
      rendererClass: perf.environment.rendererClass,
    },
    reaBundlesVerified: rea.evidenceBundles.length,
    openExternalGates,
  };

  if (strictRelease && openExternalGates.length > 0) {
    const err = new Error(
      `Strict release verification blocked by ${openExternalGates.length} external gate(s): ${openExternalGates.map((g) => g.gate).join(', ')}`
    );
    err.summary = summary;
    throw err;
  }

  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      'strict-release': { type: 'boolean', default: false },
    },
  });
  try {
    const result = verifyMilestone7({ strictRelease: values['strict-release'] });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err.summary) {
      console.error(JSON.stringify(err.summary, null, 2));
    }
    console.error(err.message);
    process.exitCode = 1;
  }
}
