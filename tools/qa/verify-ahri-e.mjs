/** Frozen Charm evidence; --historical verifies its retained checkpoint. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(option < 0 ? 'docs/reference/ahri/e-verification.json' : process.argv[option + 1])
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
assert.equal(ledger.schema, 134);
assert.equal(ledger.ruleset, '70aed54770ed65de1c7c43ee21cadea61b495a0fbe6abfce55819bcf6cb0a567');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 134;/);
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
assert.match(text(ledger.checks.unit), /335 passed \(335\)/);
assert.match(text(ledger.checks.unit), /2133 passed \(2133\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.expected, 34);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const named = (suffix) => {
  const matches = rows.filter((row) => row.file.endsWith('/' + suffix));
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const flight = data(named('ahri-e.json'));
assert.equal(flight.start.spell, 'Charm');
assert.equal(flight.start.clip, 'spell3_north');
assert.equal(flight.start.windup.releaseTick - flight.start.windup.startTick, 15);
assert.equal(flight.flight.missile.speed, 1550);
assert.equal(flight.flight.missile.radius, 60);
assert(flight.flight.markers.includes('Ahri provisional Charm'));
assert.equal(flight.controlled.exactSave, true);
assert(flight.controlled.x < flight.controlled.startX);
assert(Math.abs(flight.controlled.slow - 0.35) < 1e-6);
assert.deepEqual(flight.errors, []);
for (const phase of ['windup', 'flight', 'control']) {
  const row = data(named('ahri-e-' + phase + '-reload.json'));
  assert.equal(row.phase, phase);
  assert.equal(row.result.saved, row.expected.saved);
  assert.equal(row.result.future, row.expected.future);
  assert.equal(row.result.paused, true);
  assert.equal(row.expected.pending, phase === 'windup' ? 'e' : null);
  assert.equal(row.expected.flight, phase === 'flight');
  assert.equal(row.expected.charm !== null, phase === 'control');
}
for (const name of ['ahri-e-flight.png', 'ahri-e-controlled.png']) {
  const png = bytes(named(name));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
assert.match(text(ledger.checks.neutralOrderBefore), /Invalid neutral order/);
assert.match(text(ledger.checks.neutralOrderAfter), /79 passed \(79\)/);
for (const file of ['export.log', 'export-optimized.log'])
  assert.match(text('.cache/ahri-e-work-v1-20261025/' + file), /Verified Charm/);
for (const file of ['static-audit.log', 'static-audit-optimized.log'])
  assert.match(text('.cache/ahri-e-work-v1-20261025/' + file), /PASS/);
assert.equal(
  digest(bytes('.cache/ahri-e-contract-static-review-v1-20261025/findings.json')),
  'a1c718273e4d9029cc153794a2ba6ec79a89c55ea9941bdf814d5775ed6cbb2c'
);
assert.equal(
  digest(bytes('.cache/ahri-e-contract-static-review-v1-20261025/check.py')),
  '28797962b9046c444a55d5fb46acf446d16bf8a80b2de45fbece8c7f6c53e1ff'
);
const identity = data('.cache/ahri-e-work-v1-20261025/public-identity.json');
assert.equal(identity.baseline, 1013);
assert.equal(identity.unchanged, 1012);
assert.deepEqual(identity.changed, ['public/assets/reference-manifest.json']);
assert.deepEqual(identity.added, [
  {
    file: 'public/assets/icons/AhriE.png',
    bytes: 6464,
    sha256: 'f17a5c92b47e07664b9248428e4ff577b4ece3ebc24cd166b0710457497788f5',
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
  developmentEIntegrated: true,
  sourceTablesVerified: true,
  firstHitVerified: true,
  forcedWalkVerified: true,
  sampledTenacityVerified: true,
  dashInterruptionVerified: true,
  realBrowserReloadPhases: 3,
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
    unitTests: 2133,
    browserCases: 34,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
