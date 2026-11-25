import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyMilestone7 } from './verify-milestone7.mjs';

function makeFixtureRoot(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'm7-verify-'));
  const ruleset = overrides.ruleset ?? 'abc123ruleset';
  mkdirSync(join(root, 'docs/reference'), { recursive: true });
  mkdirSync(join(root, 'artifacts/milestone7/cohort'), { recursive: true });
  mkdirSync(join(root, 'artifacts/milestone7/rea'), { recursive: true });

  const write = (rel, obj) =>
    writeFileSync(
      join(root, rel),
      typeof obj === 'string' ? obj : `${JSON.stringify(obj, null, 2)}\n`
    );

  write('docs/reference/milestone7-discrepancy-register.json', {
    schema: 'milestone7-discrepancy-register-v1',
    patch: '26.18',
    items: Array.from({ length: 11 }, (_, i) => ({
      id: `M7-D${String(i + 1).padStart(3, '0')}`,
      severity: i === 0 ? (overrides.openP1 ? 'P1' : 'P1') : 'P2',
      status: i === 0 && overrides.openP1 ? 'open' : 'resolved',
    })),
  });

  write('artifacts/milestone7/calibration-packets.json', {
    schema: 'milestone7-calibration-packets-v1',
    ruleset: overrides.calibrationRuleset ?? ruleset,
    nativeClientComparisonStatus: overrides.nativeClientStatus ?? 'blocked-no-authorized-client',
    packets: ['CAM-01', 'MOVE-01', 'INPUT-01', 'ATK-01', 'FOG-01', 'LANE-01', 'BASE-01', 'MATCH-01'].map(
      (packetId) => ({ packetId })
    ),
  });

  for (const proj of ['chrome', 'firefox', 'webkit']) {
    if (overrides.omitBrowser === proj) continue;
    write(`artifacts/milestone7/browser-acceptance-${proj}.json`, {
      schema: 'milestone7-browser-acceptance-v1',
      project: proj,
      browserName: proj === 'chrome' ? 'chromium' : proj,
      productionBundleVerified: true,
      auditMetrics: { total: 158, missingNotes: 0 },
      rosterCheck: { uniqueChampions: 10 },
      layoutResults: ['1280x720', '1920x1080', '2560x1440'].map((resolution) => ({
        resolution,
        overflowX: false,
        overflowY: false,
        canvasCovers: true,
        hudInsideViewport: true,
        minimapInsideViewport: true,
      })),
      webglRecovery: { recovered: true },
      restartSamples: [1, 2, 3, 4, 5].map((restart) => ({ restart })),
      pageErrors: [],
    });
  }
  const pngStub = Buffer.alloc(2048, 0x89);
  for (const shot of [
    'artifacts/milestone7/m7-reference-audit.png',
    'artifacts/milestone7/m7-hud-1280x720.png',
    'artifacts/milestone7/m7-hud-1920x1080.png',
    'artifacts/milestone7/m7-hud-2560x1440.png',
  ]) {
    writeFileSync(join(root, shot), pngStub);
  }

  write('artifacts/milestone7/human-match-traces.json', {
    schema: 'milestone7-human-match-traces-v1',
    ruleset,
    totalTraces: 20,
    championsCovered: 10,
    failedTraces: 0,
  });

  const seeds = overrides.completedSeeds ?? 4;
  write('artifacts/milestone7/cohort/plan.json', {
    ruleset,
    developmentLeona: false,
    developmentRoster: false,
    qaAutomatedHumanCarry: true,
    roster: 'ten distinct public champions; five roles per team; live Rift objectives',
  });
  write('artifacts/milestone7/cohort/summary.json', {
    ruleset,
    status: 'completed',
    completed: seeds,
    victories: seeds,
    unfinished: 0,
    failures: 0,
  });

  write('artifacts/milestone7/perf-profile.json', {
    schema: 'milestone7-perf-profile-v1',
    ruleset,
    environment: {
      rendererClass: 'software-swiftshader-linux',
      physicalGpuPerfVerified: overrides.physicalGpu ?? false,
    },
    simulationLateMatch: {
      p50Ms: 0.4,
      p95Ms: 1.1,
      p99Ms: 2.0,
      within60HzSimBudget: true,
    },
  });

  const bundles = ['app-analysis.json', 'release-exposure.json', 'obligation-ledger.json'].map(
    (name, idx) => {
      const rel = `artifacts/milestone7/rea/${name}`;
      const body = JSON.stringify({ ok: true, idx });
      write(rel, body);
      return {
        evidenceId: `ev-${idx}`,
        artifactPath: rel,
        sha256:
          overrides.tamperRea && idx === 0
            ? '0'.repeat(64)
            : createHash('sha256').update(body).digest('hex'),
      };
    }
  );
  write('docs/reference/milestone7-rea-evidence.json', {
    schema: 'milestone7-rea-evidence-v1',
    ruleset,
    reaPackage: 'rea-agents@6.10.1',
    externalGates: { macosSafariVerified: overrides.macosSafari ?? false },
    evidenceBundles: bundles,
  });

  return { root, ruleset };
}

test('verifyMilestone7 passes local engineering gate and reports open external gates honestly', () => {
  const { root, ruleset } = makeFixtureRoot();
  try {
    const res = verifyMilestone7({ root, expectedRuleset: ruleset, strictRelease: false });
    assert.equal(res.result, 'passed-local-engineering');
    assert.equal(res.openExternalGates.length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifyMilestone7 --strict-release fails closed while external gates are open and passes when all 4 are satisfied', () => {
  const open = makeFixtureRoot();
  const full = makeFixtureRoot({
    completedSeeds: 100,
    nativeClientStatus: 'verified',
    macosSafari: true,
    physicalGpu: true,
  });
  try {
    assert.throws(
      () => verifyMilestone7({ root: open.root, expectedRuleset: open.ruleset, strictRelease: true }),
      /Strict release verification blocked by 4 external gate/
    );
    const res = verifyMilestone7({ root: full.root, expectedRuleset: full.ruleset, strictRelease: true });
    assert.equal(res.openExternalGates.length, 0);
  } finally {
    rmSync(open.root, { recursive: true, force: true });
    rmSync(full.root, { recursive: true, force: true });
  }
});

test('verifyMilestone7 fails closed on stale ruleset, open P1 bug, missing browser report, and tampered REA digest', () => {
  const stale = makeFixtureRoot({ calibrationRuleset: 'stale-hash' });
  const openP1 = makeFixtureRoot({ openP1: true });
  const missingWebkit = makeFixtureRoot({ omitBrowser: 'webkit' });
  const tamperedRea = makeFixtureRoot({ tamperRea: true });
  try {
    assert.throws(
      () => verifyMilestone7({ root: stale.root, expectedRuleset: stale.ruleset }),
      /ruleset does not match/
    );
    assert.throws(
      () => verifyMilestone7({ root: openP1.root, expectedRuleset: openP1.ruleset }),
      /Open local P0\/P1 engine discrepancies/
    );
    assert.throws(
      () => verifyMilestone7({ root: missingWebkit.root, expectedRuleset: missingWebkit.ruleset }),
      /Missing required Milestone 7 browser acceptance \(webkit\)/
    );
    assert.throws(
      () => verifyMilestone7({ root: tamperedRea.root, expectedRuleset: tamperedRea.ruleset }),
      /REA artifact digest mismatch/
    );
  } finally {
    rmSync(stale.root, { recursive: true, force: true });
    rmSync(openP1.root, { recursive: true, force: true });
    rmSync(missingWebkit.root, { recursive: true, force: true });
    rmSync(tamperedRea.root, { recursive: true, force: true });
  }
});
