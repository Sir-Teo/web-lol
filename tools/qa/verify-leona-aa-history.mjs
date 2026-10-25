/** Frozen Leona ordinary-attack history acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/aa-history-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.evidence];
const byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(digest(row.archived), row.sha256, row.archived);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(row.file), row.sha256, row.file);
  byFile.set(row.file, row);
}
const frozen = (p) => {
  assert(byFile.has(p), p);
  return byFile.get(p).archived;
};
const data = (p) => json(frozen(p)),
  text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 128);
assert.match(text(ledger.checks.standard), /1984 passed \(1984\)/);
assert.match(text(ledger.checks.standard), /321 passed \(321\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /44 passed/);
assert.match(text(ledger.checks.regression), /2 failed/);
assert.equal(
  digest(frozen(ledger.checks.independentFindings)),
  'cc9877dbefb5c54e3cb222e880f6806d5622b548378b6d81a2d3ce828d78ac7a'
);
assert.match(text(ledger.checks.independent), /PASS AA dispatch static/);
assert.match(text(ledger.checks.independentOptimized), /PASS AA dispatch static/);
for (const [mode, path] of Object.entries(ledger.checks.histories)) {
  const row = data(path);
  assert.equal(row.mode, mode);
  assert.deepEqual(row.errors, []);
  assert.equal(row.prepared.saved, row.restored.saved);
  assert.equal(row.prepared.future, row.restored.future);
  assert.equal(row.prepared.gl, 0);
  assert.equal(row.restored.gl, 0);
  const saved = JSON.parse(row.prepared.saved);
  assert.equal(saved.version, 128);
  assert.equal(saved.ruleset, ledger.ruleset);
  const r = row.prepared.record;
  assert.equal(r.targetRig, 'red-siege');
  assert(r.startTick < r.releaseTick && r.releaseTick < r.endTick);
  if (mode === 'canceled') {
    assert(r.cancelTick !== null);
    assert.equal(r.endReason, 'order');
    assert.equal(r.impact, null);
  } else {
    assert.equal(r.cancelTick, null);
    assert.equal(r.impact.tick, row.prepared.release);
    assert.equal(r.impact.material, 'Metal');
  }
  if (mode === 'critical') {
    assert.equal(r.kind, 'crit');
    assert.equal(r.critical, true);
    assert.equal(r.eclipse, false);
  }
  if (mode === 'eclipse') {
    assert.equal(r.kind, 'spell2_attack');
    assert.equal(r.eclipse, true);
    assert.equal(r.critical, false);
  }
}
assert.match(text('src/content/leona-aa-audio-timing.ts'), /CAST_TICKS = 30/);
assert.match(text('src/content/leona-aa-audio-timing.ts'), /HIT_TICKS = 80/);
for (const c of ['export', 'optimizedExport'])
  assert.deepEqual(data(ledger.checks[c]), {
    result: 'passed',
    checkOnly: true,
    events: 10,
    containers: 8,
    media: 28,
    reusedQ: 7,
    newMasters: 21,
    totalMasterBytes: 3130340,
    newBytes: 2366276,
  });
const controls = data(ledger.checks.bounds);
assert.equal(controls.length, 6);
assert.equal(controls.filter((r) => r.expectedPass).length, 2);
for (const r of controls) {
  assert.equal(r.returncode === 0, r.expectedPass);
  if (!r.expectedPass)
    assert.match(text(r.log), /Changed or missing output: src\/content\/leona-aa-audio-timing.ts/);
}
const production = text(ledger.checks.production)
  .trim()
  .split('\n')
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .findLast((r) => r?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.leonaPlayerFixtureInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.files.length, 1052);
assert.equal(manifest.bytes, ledger.packBytes);
assert(offline.checks.serviceWorkerResponses > 0);
assert(
  Object.values(offline.checks)
    .filter((v) => typeof v === 'boolean')
    .every(Boolean)
);
assert.equal(
  createHash('sha256')
    .update(
      JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files })
    )
    .digest('hex'),
  manifest.id
);
for (const entry of manifest.files) {
  const row = byFile.get('dist/' + entry.path);
  assert(row, entry.path);
  assert.equal(row.bytes, entry.bytes);
  assert.equal(row.sha256, entry.sha256);
}
const assets = data(ledger.checks.assets);
assert.equal(assets.publicFiles, 1005);
assert.equal(assets.unchanged, 1005);
assert.deepEqual(assets.modified, []);
assert.deepEqual(assets.removed, []);
assert.deepEqual(assets.added, []);
assert.equal(ledger.acceptance.savedAttemptsIntegrated, true);
for (const key of [
  'ordinarySourceAudioIntegrated',
  'nativeListeningVerified',
  'nativeDispatchVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 1984,
    browserCases: 44,
    publicFilesUnchanged: 1005,
    schema: 128,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
