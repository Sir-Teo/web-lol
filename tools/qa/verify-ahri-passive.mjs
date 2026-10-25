/** Frozen Essence Theft evidence; --historical verifies its retained checkpoint. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(
    option < 0 ? 'docs/reference/ahri/passive-verification.json' : process.argv[option + 1]
  )
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(digest(readFileSync(ledger.sourceArchive)), ledger.sourceArchiveSha256);
const sources = JSON.parse(readFileSync(ledger.sourceArchive)).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  const bytes = readFileSync(row.archived);
  assert.equal(bytes.length, row.bytes, row.file);
  assert.equal(digest(bytes), row.sha256, row.file);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(readFileSync(row.file)), row.sha256, row.file);
  byFile.set(row.file, row);
}
const bytes = (file) => {
  assert(byFile.has(file), file);
  return readFileSync(byFile.get(file).archived);
};
const text = (file) => bytes(file).toString();
const data = (file) => JSON.parse(text(file));
assert.equal(ledger.schema, 136);
assert.equal(ledger.ruleset, 'd55a5651959f56c24965e327a1f10e5159de9f3fe0699fcb70973a88f5587605');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 136;/);
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, ledger.packFiles);
assert.equal(pack.bytes, ledger.packBytes);
assert.equal(
  pack.files.reduce((sum, row) => sum + row.bytes, 0),
  pack.bytes
);
for (const row of pack.files) {
  assert.equal(bytes(`dist/${row.path}`).length, row.bytes);
  assert.equal(digest(bytes(`dist/${row.path}`)), row.sha256);
}
assert.match(text(ledger.checks.unit), /337 passed \(337\)/);
assert.match(text(ledger.checks.unit), /2173 passed \(2173\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.expected, 42);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const named = (suffix) => {
  const matches = rows.filter((row) => row.file.endsWith('/' + suffix));
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const flight = data(named('ahri-passive.json'));
assert.equal(flight.flight.counter.stacks, 8);
assert.equal(flight.flight.essence.kind, 'champion');
assert.equal(flight.flight.essence.stopTick, null);
assert(flight.flight.essence.position.x < flight.flight.essence.origin.x);
assert.equal(flight.flight.rush.remainingCasts, 2);
assert.deepEqual(flight.flight.markers, ['Ahri champion development Essence']);
assert.equal(flight.consumed.essence.stopReason, 'consumed');
assert.equal(flight.consumed.essence.healed, 165);
assert.equal(flight.consumed.rush.remainingCasts, 3);
assert.equal(flight.consumed.rush.resets.length, 1);
assert.equal(flight.consumed.counter.stacks, 8);
assert.equal(flight.consumed.markers, 0);
assert.equal(flight.consumed.future, flight.flight.future);
assert.equal(flight.ninth.counter.stacks, 0);
assert.equal(flight.ninth.essence.kind, 'minion');
assert.equal(flight.ninth.essence.stopReason, 'consumed');
assert.equal(flight.ninth.essence.healed, 95);
assert.equal(flight.ninth.rush.remainingCasts, 3);
assert.equal(flight.ninth.rush.resets.length, 1);
assert.deepEqual(flight.errors, []);
for (const phase of ['counter', 'flight', 'reset']) {
  const r = data(named('ahri-passive-' + phase + '-reload.json'));
  assert.equal(r.phase, phase);
  assert.equal(r.expected.saved, r.result.saved);
  assert.equal(r.expected.future, r.result.future);
  assert.equal(r.result.paused, true);
  assert.equal(r.expected.counter.stacks, 8);
  assert.equal(r.expected.rush.remainingCasts, phase === 'reset' ? 3 : 2);
  assert.equal(r.expected.rush.resets.length, phase === 'reset' ? 1 : 0);
  if (phase === 'counter') assert.deepEqual(r.expected.essences, []);
  else assert.equal(r.expected.essences[0].stopReason, phase === 'reset' ? 'consumed' : null);
}
for (const name of ['ahri-passive-flight.png', 'ahri-passive-consumed.png']) {
  const png = bytes(named(name));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
for (const f of ['export.log', 'export-optimized.log'])
  assert.match(text('.cache/ahri-passive-work-v1-20261025/' + f), /Verified Essence Theft/);
for (const f of ['static-audit.log', 'static-audit-optimized.log'])
  assert.match(text('.cache/ahri-passive-work-v1-20261025/' + f), /PASS/);
assert.equal(
  digest(bytes('.cache/ahri-passive-contract-static-review-v1-20261025/findings.json')),
  'fc20ac2ea534bfa75b87ec3216870e273d16a03f7d04c2cb3f2b7f7edd97a5d3'
);
assert.equal(
  digest(bytes('.cache/ahri-passive-contract-static-review-v1-20261025/check.py')),
  'fe2fd6bec4bfc4ed78e4a42e295c5506ddfd000a67c68023a63a90c323000e2c'
);
const identity = data('.cache/ahri-passive-work-v1-20261025/public-identity.json');
assert.deepEqual(identity, { baseline: 1015, unchanged: 1015, changed: [], added: [] });
const reports = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const r = JSON.parse(line);
      return r.result === 'passed' ? [r] : [];
    } catch {
      return [];
    }
  });
assert.equal(reports.length, 1);
assert.equal(reports[0].recordings, 32);
assert.equal(reports[0].developmentHook, false);
assert.equal(reports[0].unrequestedAhriPreloads, 0);
assert.equal(reports[0].ahriNpcFixtureInProduction, false);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(offline.manifest.files, pack.files.length);
for (const value of Object.values(offline.checks))
  if (typeof value === 'boolean') assert.equal(value, true);
assert.deepEqual(ledger.acceptance, {
  developmentPassiveIntegrated: true,
  minionMonsterCounterVerified: true,
  recentChampionTakedownsVerified: true,
  healingAndClampVerified: true,
  essenceMotionAndSavedOutcomesVerified: true,
  spiritRushEssenceResetsIntegrated: true,
  realBrowserReloadPhases: 3,
  manualNpcQWERAndPassiveControllersIntegrated: true,
  productionRosterExpanded: false,
  fullAhriKit: false,
  nativeBehaviorVerified: false,
  nativePresentationVerified: false,
  fullPerformanceGate: false,
  fullProjectComplete: false,
});
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
    sources: sources.length,
    generated: ledger.generated.length,
    evidence: ledger.evidence.length,
    unitTests: 2173,
    browserCases: 42,
    spiritRushEssenceResetsIntegrated: true,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
