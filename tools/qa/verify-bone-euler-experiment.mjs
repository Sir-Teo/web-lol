/** Retained evidence for rejected CPU candidates and accepted fixture repairs. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const record = json('docs/reference/bone-euler-experiment.json');
const verify = (pin, file) => {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
};
for (const pin of json(record.baseSourceArchive).files) verify(pin, pin.archived);
for (const pin of [...record.evidence, ...record.candidateSources, ...record.acceptedSources])
  verify(pin, pin.archived);
if (!historical) {
  for (const pin of record.acceptedSources) verify(pin, pin.file);
  assert.equal(rulesetFingerprint(), record.ruleset);
  for (const file of record.removedCandidateFiles) assert.equal(existsSync(file), false, file);
}
assert.equal(record.decision, 'rejected');
const poses = json(record.checks.poses);
assert.equal(poses.result, 'passed');
assert.equal(poses.assets.length, 30);
assert.equal(poses.samples, 3710);
assert.equal(poses.matrixScalars, 7420032);
assert.deepEqual(poses.failures, []);
assert.deepEqual(poses.errors, []);
assert.equal(
  poses.assets.reduce((sum, rig) => sum + rig.currentEuler, 0),
  0
);
const frames = json(record.checks.frames);
assert.equal(frames.samples.length, 64);
assert.deepEqual(frames.errors, []);
for (const frame of frames.samples) {
  assert.equal(frame.pixelDiff, 0);
  assert.equal(frame.bonesEqual, true);
  assert.equal(frame.labelsEqual, true);
}
const text = (file) => readFileSync(file, 'utf8');
assert.match(text(record.checks.candidateStandard), /1791 passed \(1791\)/);
assert.match(text(record.checks.candidateBrowser), /26 passed/);
assert.match(text(record.checks.baselineBrowser), /2 failed/);
assert.match(text(record.checks.repairedBrowser), /2 passed/);
assert.match(text(record.checks.acceptedStandard), /1782 passed \(1782\)/);
assert.match(text(record.checks.acceptedStandard), /pass 3/);
assert.match(text(record.checks.acceptedStandard), /fail 0/);
console.log(JSON.stringify({ result: 'passed', historical, decision: record.decision }));
