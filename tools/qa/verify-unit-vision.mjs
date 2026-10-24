/** Read-only verification of retained frame-visibility evidence. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/unit-vision-verification.json');
const verify = (pin, file) => {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
};
for (const pin of json(ledger.sourceArchive).files) {
  verify(pin, pin.archived);
  if (!historical) verify(pin, pin.file);
}
for (const pin of ledger.evidence) {
  verify(pin, pin.archived);
  // Timings, traces and outputs are immutable evidence, even in historical mode.
  verify(pin, pin.file);
}
for (const pin of ledger.generated) {
  verify(pin, pin.archived);
  if (!historical) verify(pin, pin.file);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const equivalent = json(ledger.checks.equivalence);
assert.equal(equivalent.result, 'passed');
assert.equal(equivalent.simulationTicks, 3600);
assert.equal(equivalent.restoredFutureTicks, 60);
assert.equal(equivalent.queries, 65574);
const pixels = json(ledger.checks.pixels);
assert.equal(pixels.samples.length, 40);
assert.deepEqual(pixels.errors, []);
for (const frame of pixels.samples) {
  assert.equal(frame.pixelDiff, 0);
  assert.equal(frame.bonesEqual, true);
  assert.equal(frame.labelsEqual, true);
}
const query = json(ledger.checks.queryBenchmark);
assert.equal(query.unchanged, true);
assert.equal(query.samples.length, 22);
assert.equal(new Set(query.samples.map((sample) => sample.visible)).size, 1);
assert.deepEqual(query.errors, []);
const standard = readFileSync(ledger.checks.standard, 'utf8');
assert.match(standard, /1782 passed \(1782\)/);
assert.match(standard, /293 passed \(293\)/);
assert.match(standard, /pass 3/);
assert.match(standard, /fail 0/);
assert.match(readFileSync(ledger.checks.browser, 'utf8'), /18 passed/);
assert.match(readFileSync(ledger.checks.browserRepaired, 'utf8'), /1 passed/);
assert.equal(json(ledger.checks.production).developmentHook, false);
console.log(JSON.stringify({ result: 'passed', historical, ruleset: ledger.ruleset }));
