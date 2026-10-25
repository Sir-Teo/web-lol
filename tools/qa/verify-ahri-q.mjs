/** Frozen development Q verification; --historical checks retained source bytes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(option < 0 ? 'docs/reference/ahri/q-verification.json' : process.argv[option + 1])
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(digest(readFileSync(ledger.sourceArchive)), ledger.sourceArchiveSha256);
const sources = JSON.parse(readFileSync(ledger.sourceArchive)).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence];
const byFile = new Map();
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
assert.equal(ledger.schema, 132);
assert.equal(ledger.ruleset, '0fba88792336cee69705cbd320025192ea4427b6d33f1291cb05d8707c121720');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 132;/);
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
assert.match(text(ledger.checks.unit), /333 passed \(333\)/);
assert.match(text(ledger.checks.unit), /2090 passed \(2090\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
for (const [file, count] of [
  [ledger.checks.browser, 23],
  [ledger.checks.reload, 3],
]) {
  const report = data(file);
  assert.equal(report.stats.expected, count);
  assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.flaky, 0);
}
const flightRow = rows.filter((row) => row.file.endsWith('/ahri-q.json'));
assert.equal(flightRow.length, 1);
const flight = data(flightRow[0].file);
assert.equal(flight.cast.clip, 'spell1');
assert.equal(flight.cast.spellName, 'Orb of Deception');
assert.equal(flight.cast.windup.releaseTick - flight.cast.windup.startTick, 15);
assert.equal(flight.outward.marker, 'Ahri Q development orb');
assert.equal(flight.outward.exactSave, true);
assert(flight.outward.orb.outwardHits.length > 0);
assert.equal(flight.outward.orb.returnHits.length, 0);
assert(flight.returning.orb.returnHits.length > 0);
assert.equal(flight.outward.future, flight.cast.future);
assert.equal(flight.returning.future, flight.cast.future);
assert.equal(flight.result.saved, flight.cast.future);
assert.equal(JSON.parse(flight.result.saved).ruleset, ledger.ruleset);
assert.deepEqual(flight.result.damage, [70, 70, 70]);
assert.equal(flight.result.orbs, 0);
assert.equal(flight.result.focus, 0);
for (const phase of ['windup', 'outward', 'return']) {
  const matches = rows.filter((row) => row.file.endsWith(`/ahri-q-${phase}-reload.json`));
  assert.equal(matches.length, 1);
  const result = data(matches[0].file);
  assert.equal(result.phase, phase);
  assert.equal(result.expected.pending, phase === 'windup');
  assert.equal(result.expected.orbs, phase === 'windup' ? 0 : 1);
  assert.equal(result.result.saved, result.expected.saved);
  assert.equal(result.result.future, result.expected.future);
  assert.equal(result.result.paused, true);
  assert.equal(result.result.dead, phase === 'return');
  assert.deepEqual(result.result.markers, phase === 'windup' ? [] : ['Ahri Q development orb']);
  assert.equal(JSON.parse(result.result.saved).ruleset, ledger.ruleset);
}
for (const name of ['ahri-q-outward.png', 'ahri-q-return.png']) {
  const matches = rows.filter((row) => row.file.endsWith('/' + name));
  assert.equal(matches.length, 1);
  const image = bytes(matches[0].file);
  assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(image.readUInt32BE(16), 1440);
  assert.equal(image.readUInt32BE(20), 900);
}
const reports = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return value.result === 'passed' ? [value] : [];
    } catch {
      return [];
    }
  });
assert.equal(reports.length, 1);
const production = reports[0];
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.ahriNpcFixtureInProduction, false);
assert.equal(production.unrequestedAhriPreloads, 0);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(offline.manifest.files, pack.files.length);
for (const value of Object.values(offline.checks))
  if (typeof value === 'boolean') assert.equal(value, true);
for (const file of ['export.log', 'export-optimized.log'])
  assert.match(text('.cache/ahri-q-work-v1-20261025/' + file), /Verified Ahri Q/);
for (const file of ['static-audit.log', 'static-audit-optimized.log'])
  assert.match(text('.cache/ahri-q-work-v1-20261025/' + file), /PASS/);
assert.deepEqual(ledger.acceptance, {
  developmentQIntegrated: true,
  twoLegPayloadVerified: true,
  exactFixedStepMotionVerified: true,
  realBrowserReloadPhases: 3,
  casterDeathContinuationVerified: true,
  capturedDamageVerified: true,
  manualSpellAllocation: true,
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
    unitTests: 2090,
    browserCases: 26,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
