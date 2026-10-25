/** Frozen development-player rendering observation; no full-performance claim. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  ledgerIndex = process.argv.indexOf('--ledger');
const json = (p) => JSON.parse(readFileSync(p)),
  digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json(
  ledgerIndex < 0
    ? 'docs/reference/leona/rift-render-verification.json'
    : process.argv[ledgerIndex + 1]
);
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(digest(row.archived), row.sha256, row.archived);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(row.file), row.sha256, row.file);
  byFile.set(row.file, row);
}
const frozen = (p) => {
    const r = byFile.get(p);
    assert(r, p);
    return r.archived;
  },
  data = (p) => json(frozen(p)),
  text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 130);
assert.equal(ledger.shippedChange, false);
const base = data('docs/reference/leona/support-ai-verification.json');
assert.equal(base.ruleset, ledger.ruleset);
assert.equal(base.pack, ledger.pack);
assert.deepEqual(base.generated, ledger.generated);
assert.match(text(ledger.checks.qa), /pass 3/);
assert.match(text(ledger.checks.previousAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.previousAccepted), /"historical":true/);
assert.match(
  text(ledger.checks.regression),
  /Browser did not restore the exact benchmark checkpoint/
);
assert.match(text(ledger.checks.missingContext), /explicit --development-leona context/);
const selection = data(ledger.checks.selection);
assert.equal(selection.candidates.length, 43);
assert.equal(selection.selected.seed, 26018);
assert.equal(selection.selected.tick, 118800);
assert(selection.selected.remainingTicks >= 7200);
assert.equal(selection.selected.nearbyChampions, 4);
assert.equal(selection.selected.nearbyEnemyChampions, 2);
assert.equal(selection.selected.nearbyMinions, 4);
const input = frozen(selection.checkpoint),
  raw = readFileSync(input, 'utf8');
assert(raw.endsWith('\n'));
assert.equal(digest(input), selection.selected.checkpointSha256);
const original = selection.selected.path.slice(ledger.workspaceRoot.length + 1),
  pin = base.evidence.find((r) => r.file === original);
assert(pin, original);
assert.equal(pin.sha256, selection.selected.checkpointSha256);
assert.equal(digest(pin.archived), pin.sha256);
const state = JSON.parse(raw);
assert.equal(state.version, 130);
assert.equal(state.ruleset, ledger.ruleset);
assert.equal(state.player.role, 'support');
assert.equal(state.units.find((u) => u.id === state.player.id).champion, 'leona');
const oldSource = json(base.sourceArchive).files.find(
  (r) => r.file === 'tools/qa/benchmark-rift.mjs'
);
assert(oldSource);
assert.equal(digest(frozen(ledger.checks.oldBenchmark)), oldSource.sha256);
const reports = Object.fromEntries(
  ['cadence', 'gpu', 'ordinary'].map((k) => [k, data(ledger.checks[k])])
);
const approximate = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
for (const [name, r] of Object.entries(reports)) {
  const leona = name !== 'ordinary',
    source = leona ? raw : text(ledger.checks.ordinaryInput);
  assert.equal(r.result, 'measured');
  assert.equal(r.benchmarkSHA256, digest(frozen('tools/qa/benchmark-rift.mjs')));
  assert.equal(r.snapshotSHA256, createHash('sha256').update(source).digest('hex'));
  assert.equal(
    r.canonicalSnapshotSHA256,
    createHash('sha256').update(source.trimEnd()).digest('hex')
  );
  assert.equal(r.exactCheckpointRestored, true);
  assert.equal(r.developmentLeona, leona);
  assert.equal(r.followPlayer, leona);
  assert.equal(r.saveKey, leona ? 'development-leona-rift' : 'rift');
  assert.equal(r.cameraPolicy, leona ? 'owned-player' : 'visible-opponent-density');
  assert.equal(r.cameraSubject.champion, leona ? 'leona' : 'ashe');
  if (leona) assert.equal(r.cameraSubject.id, 1);
  assert.equal(r.startingTick, leona ? 118800 : 7200);
  assert.equal(r.sampleCount, 1800);
  assert.equal(r.warmupCount, 120);
  assert.equal(r.frames.n, 1800);
  assert.match(r.frameClock, /requestAnimationFrame timestamp/);
  assert.equal(r.championRoster.length, 10);
  assert.equal(r.audioContextState, 'not-unlocked');
  assert.deepEqual(r.viewport, [1920, 1080]);
  assert.equal(r.hardware.cpu, 'Apple M1');
  assert.equal(r.hardware.memoryGiB, 16);
  assert.equal(r.hardware.arch, 'arm64');
  assert.equal(r.browser, '156.0.8078.47');
  assert.match(r.graphicsContext.unmaskedRenderer, /ANGLE Metal Renderer: Apple M1/);
  for (const field of [
    'frames',
    'callbackDeliveryIntervals',
    'renderCalls',
    'simulationSteps',
    'drawCalls',
    'renderedTriangles',
  ]) {
    const v = r[field];
    assert(v.n > 0);
    assert(v.median >= 0 && v.median <= v.p95 && v.p95 <= v.p99);
  }
  assert(r.time > r.startingTick / 60);
  assert.equal(r.cpuProfileEnabled, false);
  assert.equal(r.rawBoneTracks, false);
}
approximate(reports.cadence.frames.p95, 16.8);
approximate(reports.cadence.frames.p99, 16.8);
assert.equal(reports.cadence.intervalsAbove25MS, 2);
assert.equal(reports.cadence.renderCalls.n, 1798);
approximate(reports.cadence.renderCalls.p95, 7.4);
assert.equal(reports.cadence.drawCalls.median, 117);
assert.equal(reports.cadence.activity.maxVisibleChampions, 7);
assert.equal(reports.cadence.activity.maxProjectiles, 32);
assert.equal(reports.cadence.activity.maxSingularities, 1);
assert.equal(reports.cadence.activity.maxLuxBeams, 0);
const gpu = reports.gpu.gpu;
assert.equal(reports.gpu.gpuTiming, true);
assert.equal(gpu.supported, true);
assert.equal(gpu.milliseconds.n, reports.gpu.renderCalls.n);
assert.equal(gpu.milliseconds.n, 1798);
for (const k of ['discarded', 'skipped', 'unresolved']) assert.equal(gpu[k], 0);
approximate(gpu.milliseconds.median, 2.718541);
approximate(gpu.milliseconds.p95, 5.680791);
approximate(gpu.milliseconds.p99, 7.436625);
assert.equal(reports.cadence.gpu, null);
assert.equal(reports.ordinary.gpu, null);
assert.equal(reports.ordinary.intervalsAbove25MS, 0);
const guard = data(ledger.checks.guard);
assert.equal(guard.result, 'passed');
assert.equal(guard.status, 1);
assert.deepEqual(guard.before, guard.after);
assert.equal(guard.after['.json'], digest(frozen(ledger.checks.cadence)));
assert.equal(guard.after['.png'], digest(frozen(ledger.checks.capture)));
for (const k of [
  'benchmarkTrialRestoreIntegrated',
  'playerCameraIntegrated',
  'scopedM1MeasurementVerified',
  'existingOutputsProtected',
])
  assert.equal(ledger.acceptance[k], true);
for (const k of [
  'fullPerformanceGate',
  'audioPerformanceVerified',
  'nativeComparisonVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    shippedChange: false,
    reports: 3,
    frameSamples: 5400,
    gpuSamples: 1798,
    frameTimestampP95: reports.cadence.frames.p95,
    gpuElapsedP95: gpu.milliseconds.p95,
    fullPerformanceGate: false,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
