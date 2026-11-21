/** Verify Milestone 5 source digests, ruleset invariance, current pack closure, and local audit receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const MILESTONE5_BASELINE_RULESET =
  '1cf6e4e9b814a10bcd727579afc7485af55df0f870b7deed6cfdaadb58989ce7';

const IMMUTABLE_MILESTONE5_FILES = new Set([
  'src/storage/sound-preference.ts',
  'src/storage/offline-pack.ts',
  'src/render/lazy-leona-eclipse-surfaces.ts',
  'src/render/lazy-leona-zenith-surfaces.ts',
  'src/render/lazy-leona-solar-surfaces.ts',
  'src/ui/attack-stat-tooltip.ts',
  'src/ui/scoreboard-item-tooltip.ts',
  'tests/milestone5-replay-and-mix.test.ts',
  'e2e/milestone5-browser-acceptance.spec.ts',
  'tools/qa/multibrowser.playwright.config.ts',
  'tools/qa/offline-pack.mjs',
  'tools/qa/simulate-rift.mjs',
  'docs/MILESTONE-5.md',
]);

export function verifyMilestone5(ledgerPath = 'docs/reference/milestone5-verification.json') {
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'));
  const snapshotSource = readFileSync(resolve('src/simulation/snapshot.ts'), 'utf8');
  assert.equal(ledger.milestone, 5, 'Expected Milestone 5 verification ledger');
  assert.equal(ledger.snapshotVersion, 184);
  assert.equal(
    ledger.ruleset,
    MILESTONE5_BASELINE_RULESET,
    'Ruleset fingerprint drifted from Milestone 4/5 baseline'
  );
  const versionMatch = snapshotSource.match(/export const SNAPSHOT_VERSION = (\d+);/);
  assert.ok(versionMatch, 'Missing SNAPSHOT_VERSION declaration');
  const currentVersion = Number(versionMatch[1]);
  assert.ok(currentVersion >= 184, 'Unexpected SNAPSHOT_VERSION regression');
  assert.match(snapshotSource, /export const SNAPSHOT_RULESET = __SIMULATION_HASH__;/);

  const isLiveMilestone5 = currentVersion === 184;
  if (isLiveMilestone5) {
    assert.equal(
      rulesetFingerprint(),
      ledger.ruleset,
      'Ruleset fingerprint drifted from Milestone 4/5 baseline'
    );
  }

  let verifiedSourceCount = 0;
  for (const entry of ledger.sourceDigests) {
    if (!isLiveMilestone5 && !IMMUTABLE_MILESTONE5_FILES.has(entry.file)) continue;
    const raw = readFileSync(resolve(entry.file));
    assert.equal(raw.length, entry.bytes, `Byte length mismatch for ${entry.file}`);
    assert.equal(sha256(raw), entry.sha256, `SHA-256 mismatch for ${entry.file}`);
    verifiedSourceCount++;
  }

  let packVerified = false;
  if (isLiveMilestone5 && existsSync(resolve('dist/offline-pack.json'))) {
    const packReport = verifyCurrentPack('dist');
    assert.equal(packReport.result, 'passed');
    assert.equal(
      packReport.pack,
      ledger.pack.id,
      'Built offline pack ID differs from Milestone 5 ledger'
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
    localArtifactsChecked.push(artifact.file);
  }

  return {
    result: 'passed',
    milestone: ledger.milestone,
    snapshotVersion: ledger.snapshotVersion,
    historicalSuperseded: !isLiveMilestone5,
    ruleset: ledger.ruleset,
    pack: ledger.pack.id,
    packVerified,
    sourceFilesVerified: isLiveMilestone5 ? ledger.sourceDigests.length : verifiedSourceCount,
    recordedSourceFiles: ledger.sourceDigests.length,
    localArtifactsChecked: localArtifactsChecked.length,
    reaRecords: ledger.reaCertification.records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyMilestone5(process.argv[2])));
}
