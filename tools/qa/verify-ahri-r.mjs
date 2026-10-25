/** Frozen Spirit Rush evidence; --historical verifies its retained checkpoint. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(option < 0 ? 'docs/reference/ahri/r-verification.json' : process.argv[option + 1])
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
assert.equal(ledger.schema, 135);
assert.equal(ledger.ruleset, '86ba88f0caeb4e222145f8c4b4bfc54ad17f15ffcaa25827582b444af77db5c8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 135;/);
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
assert.match(text(ledger.checks.unit), /336 passed \(336\)/);
assert.match(text(ledger.checks.unit), /2154 passed \(2154\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.expected, 38);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const named = (suffix) => {
  const matches = rows.filter((row) => row.file.endsWith('/' + suffix));
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const flight = data(named('ahri-r.json'));
assert.equal(flight.start.spell, 'Spirit Rush');
assert.equal(flight.start.clip, 'spell4');
assert.deepEqual(flight.start.markers, Array(3).fill('Ahri R development essence bolt'));
assert.equal(flight.start.rush.remainingCasts, 2);
assert.equal(flight.start.rush.endTick - flight.start.rush.startTick, 900);
assert.equal(flight.start.rush.bursts[0].bolts.length, 3);
assert(Math.abs(flight.arrived.distance - 500) < 1e-6);
assert.equal(flight.arrived.burst.stopReason, 'arrived');
assert.equal(flight.arrived.burst.stopTick - flight.arrived.burst.startTick, 24);
assert(flight.arrived.burst.bolts.every((p) => p.stopReason === 'hit'));
assert.equal(flight.arrived.future, flight.start.future);
assert.equal(flight.recast.rush.remainingCasts, 1);
assert.equal(flight.recast.rush.bursts.length, 2);
assert(flight.recast.manaAfter >= flight.recast.manaBefore);
assert.equal(flight.recast.cooldownAfter, flight.recast.cooldownBefore);
assert.deepEqual(flight.errors, []);
for (const phase of ['dash', 'recovery', 'recast']) {
  const r = data(named('ahri-r-' + phase + '-reload.json'));
  assert.equal(r.phase, phase);
  assert.equal(r.expected.saved, r.result.saved);
  assert.equal(r.expected.future, r.result.future);
  assert.equal(r.result.paused, true);
  assert.equal(r.expected.rush.bursts.length, phase === 'recast' ? 2 : 1);
  assert.equal(r.expected.rush.bursts.at(-1).stopTick === null, phase !== 'recovery');
}
for (const name of ['ahri-r-dash.png', 'ahri-r-arrived.png']) {
  const png = bytes(named(name));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
assert.match(text(ledger.checks.angledBefore), /Saved match contains invalid Spirit Rush state/);
assert.match(text(ledger.checks.angledAfter), /84 passed \(84\)/);
assert.match(text('src/simulation/ahri-spirit-rush.ts'), /world.tick - dash.startTick \+ 1/);
for (const f of ['export.log', 'export-optimized.log'])
  assert.match(text('.cache/ahri-r-work-v1-20261025/' + f), /Verified Spirit Rush/);
for (const f of ['static-audit.log', 'static-audit-optimized.log'])
  assert.match(text('.cache/ahri-r-work-v1-20261025/' + f), /PASS/);
assert.equal(
  digest(bytes('.cache/ahri-r-contract-static-review-v1-20261025/findings.json')),
  '6a0ac2a97ae419e3037ca38859342b14ebb69b08010b1aaef8fd5f61592967fd'
);
assert.equal(
  digest(bytes('.cache/ahri-r-contract-static-review-v1-20261025/check.py')),
  '17dde8eb0ffd125e52ff5f05cff4e86bde096ab204934801be5523bff4943658'
);
const identity = data('.cache/ahri-r-work-v1-20261025/public-identity.json');
assert.equal(identity.baseline, 1014);
assert.equal(identity.unchanged, 1013);
assert.deepEqual(identity.changed, ['public/assets/reference-manifest.json']);
assert.deepEqual(identity.added, [
  {
    file: 'public/assets/icons/AhriR.png',
    bytes: 6639,
    sha256: '5c1095c39353b5f7af61b8c66d818b82bcdfcfbbddd3cadedc526e47fa8b42fe',
  },
]);
for (const row of identity.added) assert.equal(digest(bytes(row.file)), row.sha256);
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
  developmentRBaseIntegrated: true,
  sourceTablesVerified: true,
  paidActivationFreeRecastsVerified: true,
  distinctChampionPriorityTargetsVerified: true,
  interruptedDashVerified: true,
  angledArrivalFramesVerified: true,
  realBrowserReloadPhases: 3,
  passiveEssenceResetsIntegrated: false,
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
    unitTests: 2154,
    browserCases: 38,
    passiveEssenceResetsIntegrated: false,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
