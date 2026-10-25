/** Frozen Fox-Fire evidence; --historical verifies its retained checkpoint. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(option < 0 ? 'docs/reference/ahri/w-verification.json' : process.argv[option + 1])
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
assert.equal(ledger.schema, 133);
assert.equal(ledger.ruleset, '3189941362620dddce36fb83291b6e53d372d99484a98be1db5d98d8ae1134d3');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 133;/);
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
assert.match(text(ledger.checks.unit), /334 passed \(334\)/);
assert.match(text(ledger.checks.unit), /2110 passed \(2110\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.expected, 30);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const named = (suffix) => {
  const matches = rows.filter((row) => row.file.endsWith('/' + suffix));
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const flight = data(named('ahri-w.json'));
assert.equal(flight.start.spell, 'Fox-Fire');
assert.equal(flight.start.clip, 'spell2');
assert.deepEqual(flight.start.markers, Array(3).fill('Ahri W development orbit'));
assert.deepEqual(
  flight.start.cast.fires.map((f) => f.phase),
  ['orbit', 'orbit', 'orbit']
);
assert.equal(flight.start.cast.releaseTick - flight.start.cast.startTick, 15);
assert.deepEqual(flight.flight.markers, Array(3).fill('Ahri W development flight'));
assert(flight.flight.cast.fires.every((f) => f.phase === 'flight'));
assert.equal(flight.flight.exactSave, true);
assert.equal(flight.flight.future, flight.start.future);
assert.equal(flight.hits.future, flight.start.future);
assert.equal(flight.result.saved, flight.start.future);
assert.equal(JSON.parse(flight.result.saved).ruleset, ledger.ruleset);
assert(Math.abs(flight.hits.damage - 72) < 1e-5);
assert(flight.hits.cast.fires.every((f) => f.stopReason === 'hit'));
assert.equal(flight.hits.cast.fires.filter((f) => f.hit.repeat).length, 2);
assert(flight.start.speed > flight.hits.speed && flight.hits.speed > 330);
assert.equal(flight.hits.markers, 0);
assert.equal(flight.result.markers, 0);
assert.equal(flight.result.casts, 0);
for (const phase of ['orbit', 'flight', 'spent']) {
  const row = data(named(`ahri-w-${phase}-reload.json`));
  assert.equal(row.phase, phase);
  assert.equal(row.result.saved, row.expected.saved);
  assert.equal(row.result.future, row.expected.future);
  assert.equal(row.result.speed, row.expected.speed);
  assert.equal(row.result.active, row.expected.active);
  assert.equal(row.result.dead, phase === 'flight');
  assert.equal(row.result.paused, true);
  assert.equal(JSON.parse(row.result.saved).ruleset, ledger.ruleset);
  if (phase === 'flight') assert(row.expected.phases.includes('flight'));
  else assert.deepEqual(row.expected.phases, Array(3).fill(phase));
}
for (const image of ['ahri-w-orbits.png', 'ahri-w-flights.png']) {
  const png = bytes(named(image));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
assert.match(text(ledger.checks.crossCastBefore), /Saved match contains invalid Fox-Fire state/);
assert.match(text(ledger.checks.crossCastBefore), /1 failed \| 8 passed \(9\)/);
assert.match(text(ledger.checks.crossCastAfter), /47 passed \(47\)/);
assert.match(text(ledger.checks.protectedBefore), /2 failed \| 29 skipped \(31\)/);
assert.match(text(ledger.checks.protectedAfter), /67 passed \(67\)/);
assert.match(text('src/simulation/ahri-orbs.ts'), /world\.vulnerable\(unit\)/);
assert.match(text('src/simulation/ahri-fox-fires.ts'), /world\.vulnerable\(unit\)/);
for (const file of ['export.log', 'export-optimized.log'])
  assert.match(text('.cache/ahri-w-work-v1-20261025/' + file), /Verified Fox-Fire/);
for (const file of ['static-audit.log', 'static-audit-optimized.log'])
  assert.match(text('.cache/ahri-w-work-v1-20261025/' + file), /PASS/);
const reports = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const row = JSON.parse(line);
      return row.result === 'passed' ? [row] : [];
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
  developmentWIntegrated: true,
  sourceTablesVerified: true,
  repeatDamageVerified: true,
  movementDecayVerified: true,
  realBrowserReloadPhases: 3,
  crossCastDeathFrameVerified: true,
  sharedEmergenceProtectionVerified: true,
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
    unitTests: 2110,
    browserCases: 30,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
