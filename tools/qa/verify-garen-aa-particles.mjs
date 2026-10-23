/** Read-only integrity audit; recorded behavior is not a fresh browser/native run. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/garen-aa-particles-verification.json');
assert.equal(ledger.schema, 115);
const verify = (p) => {
  const raw = readFileSync(p.file);
  assert.equal(raw.length, p.bytes, p.file);
  assert.equal(createHash('sha256').update(raw).digest('hex'), p.sha256, p.file);
};
for (const p of ledger.evidence) verify(p);
if (!historical) {
  assert.equal(rulesetFingerprint(), ledger.ruleset);
  for (const p of ledger.implementation) verify(p);
}
const simulation = json(ledger.historicalInputs.simulationLedger);
assert.equal(simulation.ruleset, ledger.ruleset);
for (const p of simulation.files) verify({ ...p, file: p.archived });
const presentation = json(ledger.historicalInputs.presentationLedger);
for (const p of presentation.files) verify({ ...p, file: p.archived });
const overlay = new Map(presentation.files.map((p) => [p.original, p.archived]));
const sourceFile = historical
  ? overlay.get('docs/reference/garen-aa-particles-source.json')
  : 'docs/reference/garen-aa-particles-source.json';
const source = json(sourceFile);
for (const p of [source.output, source.timing, ...source.assets.map((a) => a.output)])
  verify({ ...p, file: historical ? overlay.get(p.file) : p.file });
const data = json(
  historical
    ? overlay.get('src/content/garen-aa-particles.json')
    : 'src/content/garen-aa-particles.json'
);
const active = data.profiles.flatMap((p, i) => (p.deferred ? [] : [i]));
assert.equal(data.profiles.length, 14);
assert.equal(active.length, 12);
assert.equal(source.assets.length, 22);
assert.equal(data.events.length, 4);
assert(!data.events.some((e) => e.clip === 'crit'));
const seen = new Set();
for (const file of ledger.checks.chrome.pixelReports) {
  const report = json(file);
  assert.equal(report.error, 0);
  assert(report.changed > 0);
  for (const p of report.perProfile) {
    assert(p.changed > 0);
    seen.add(p.profile);
  }
}
assert.deepEqual(
  [...seen].sort((a, b) => a - b),
  active
);
const recovery = json(ledger.checks.chrome.recoveryReport);
assert.deepEqual(recovery.pixels, { differences: 0, error: 0 });
assert(recovery.terminal.active > 0);
assert.equal(recovery.terminal.remaining, 0);
assert.equal(recovery.terminal.frozen, true);
const audience = json(ledger.checks.chrome.audienceReport).result;
assert(audience.hiddenAtCreation && audience.revealed);
assert.equal(audience.oldMeshes, 0);
assert(audience.newMeshes > 0);
const network = json(ledger.checks.production.networkReport);
for (const p of json(ledger.checks.production.buildArchive).files) verify(p);
assert.equal(network.exitCode, 0);
assert(network.requestCount > 0);
assert.deepEqual(network.garenAA, []);
const unitLog = readFileSync(ledger.checks.standard.log, 'utf8');
assert(unitLog.includes('1485 passed (1485)') && unitLog.includes('269 passed (269)'));
assert(unitLog.includes('pass 3') && unitLog.includes('fail 0'));
assert(readFileSync(ledger.checks.chrome.finalLog, 'utf8').includes('13 passed'));
const cohort = json(ledger.checks.normalSmoke.verificationLog);
assert.equal(cohort.result, 'passed');
assert.equal(cohort.ruleset, ledger.ruleset);
assert.equal(cohort.checkedTicks, 72000);
assert.equal(cohort.roundTrips, 20);
assert.equal(cohort.futureChecks, 18);
assert.equal(json(ledger.checks.normalSmoke.comparison).matches.length, 20);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    activeEmitters: active.length,
    deferred: 2,
    unit: 1485,
    chromeFinal: 13,
    recordedSmokeTicks: cohort.checkedTicks,
    nativeParityCertified: false,
    fullGarenCertified: false,
  })
);
