/** Read-only integrity audit of recorded source/validation evidence; no native behavior claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/leona/verification.json');
function verify(pin, file = pin.file) {
  const raw = readFileSync(file);
  assert.equal(raw.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(raw).digest('hex'), pin.sha256, file);
}
for (const pin of ledger.evidence) verify(pin);
const archive = json(ledger.sourceArchive);
assert.equal(archive.ruleset, ledger.ruleset);
assert.equal(archive.sourceFileCount, archive.files.length);
const frozen = new Map();
for (const pin of archive.files) {
  const file = `${ledger.frozenInputs}/${pin.file}`;
  verify(pin, file);
  frozen.set(pin.file, file);
}
for (const pin of ledger.implementation) {
  assert(frozen.has(pin.file), `Missing frozen implementation: ${pin.file}`);
  verify(pin, historical ? frozen.get(pin.file) : pin.file);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
for (const pin of json(ledger.buildArchive).files) verify(pin);
for (const pin of ledger.officialSources) verify(pin);
const standard = readFileSync(ledger.checks.standard, 'utf8');
assert(standard.includes('1493 passed (1493)') && standard.includes('270 passed (270)'));
assert(standard.includes('pass 3') && standard.includes('fail 0'));
assert(readFileSync(ledger.checks.focused, 'utf8').includes('8 passed (8)'));
assert(readFileSync(ledger.checks.build, 'utf8').includes('built in'));
assert(
  readFileSync(ledger.checks.archiveDecode, 'utf8').includes(
    'Verified all 51 Leona records against the retained 24,399-byte frozen BIN and repeated pinned-archive extraction.'
  )
);
const earlier = json(ledger.checks.priorGarenIntegrity);
assert.equal(earlier.result, 'passed');
assert.equal(earlier.historical, true);
assert.equal(earlier.nativeParityCertified, false);
assert.equal(ledger.acceptance.playableKit, false);
assert.equal(ledger.acceptance.nativeBehaviorVerified, false);
assert.equal(ledger.acceptance.productionRosterExpanded, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    ruleset: ledger.ruleset,
    archivedInputs: archive.files.length,
    characterRecords: 51,
    unitTests: 1493,
    leonaTests: 8,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    playableKit: false,
    nativeBehaviorVerified: false,
  })
);
