/** Verify Milestone 6 source digests, ruleset fingerprint, reference-coverage invariants, offline pack closure, and REA Evidence bundle receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE6_BASELINE_RULESET =
  'e5e3cc7f70fae406cd8bf03ba5a5a90fc7dc87ab2e931ad190b5fe099897cad0';

const IMMUTABLE_MILESTONE6_FILES = new Set([
  'src/content/role-quests.ts',
  'src/simulation/role-quests.ts',
  'src/content/epic-objectives.ts',
  'src/simulation/epic-objectives.ts',
  'src/content/faelights.ts',
  'src/content/expanded-items.ts',
  'src/simulation/item-effects.ts',
  'src/content/runes.ts',
  'src/content/milestone6-champions.ts',
  'src/simulation/milestone6-champions.ts',
  'src/render/milestone6-visuals.ts',
  'tests/milestone6-systems.test.ts',
  'tests/milestone6-roster-contract.test.ts',
  'e2e/milestone6-reference-expansion.spec.ts',
  'tools/qa/milestone6-multibrowser.playwright.config.ts',
  'tools/assets/generate-milestone6-assets.mjs',
]);

export function verifyMilestone6(ledgerPath = 'docs/reference/milestone6-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 6, 'Expected Milestone 6 verification ledger');
  assert.equal(ledger.snapshotVersion, 185);
  assert.equal(
    ledger.ruleset,
    MILESTONE6_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 6 baseline'
  );
  assert.equal(ledger.roster.distinctChampions, 10, 'Expected 10 distinct champions');
  assert.equal(ledger.roster.mirrorMatchupsInDefault5v5, 0, 'Expected zero-mirror default 5v5');
  assert.equal(
    ledger.referenceCoverage.unimplemented,
    0,
    'Milestone 6 reference coverage must have zero unimplemented entries'
  );
  assert.equal(
    ledger.referenceCoverage.verifiedBehavior +
      ledger.referenceCoverage.verifiedData +
      ledger.referenceCoverage.approximation +
      ledger.referenceCoverage.unimplemented,
    ledger.referenceCoverage.total,
    'Reference coverage status counts must sum to total'
  );

  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 185, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone6 = currentVersion === 185;
  if (isLiveMilestone6) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Ruleset fingerprint drifted from Milestone 6 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone6 && !IMMUTABLE_MILESTONE6_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone6 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 6 ledger'
    );
    assert.equal(packReport.files, ledger.pack.files);
    assert.equal(packReport.bytes, ledger.pack.bytes);
    assert.equal(packReport.workerPolicySha256, ledger.pack.workerPolicySha256);
    packVerified = true;
  }

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
    if (artifact.file.endsWith('milestone6-rea-evidence-bundle.json')) {
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
    historicalSuperseded: !isLiveMilestone6,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    referenceEntries: ledger.referenceCoverage.total,
    distinctChampions: ledger.roster.distinctChampions,
    sourceFilesVerified: isLiveMilestone6 ? ledger.sourceDigests.length : verifiedSourceCount,
    recordedSourceFiles: ledger.sourceDigests.length,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyMilestone6(process.argv[2])));
}
