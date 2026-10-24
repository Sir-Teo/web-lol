/** Read-only source-kernel evidence; drawing, audio and native acceptance remain open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-kernel-verification.json');
const verify = (pin, file) => {
  assert.equal(readFileSync(file).length, pin.bytes, file);
  assert.equal(hash(file), pin.sha256, file);
};
const source = json(ledger.sourceArchive);
const frozen = (file) => source.files.find((pin) => pin.file === file).archived;
for (const pin of source.files) {
  verify(pin, pin.archived);
  if (!historical) verify(pin, pin.file);
}
for (const archive of [ledger.nativeArchive, ledger.readerArchive])
  for (const pin of json(archive).files) verify(pin, pin.archived);
for (const pin of ledger.evidence) verify(pin, pin.archived);
for (const pin of ledger.acceptedBuild) {
  verify(pin, pin.archived);
  if (!historical) verify(pin, pin.file);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const profiles = json(frozen('src/content/leona-e-particles.json'));
const raw = json(frozen('docs/reference/leona-e-particles.json'));
const audit = json(frozen('docs/reference/leona-e-particle-profiles.json'));
assert.equal(profiles.profiles.length, 20);
assert.equal(profiles.disabled.length, 13);
for (const p of profiles.profiles) {
  const original = raw.resources[p.system].definition.complexEmitterDefinitionData[p.index];
  assert.deepEqual(p.sourceFields, Object.keys(original).sort());
  assert(p.sourceFields.every((key) => Object.hasOwn(audit.fieldRoutes, key)));
}
for (const p of profiles.disabled)
  assert.deepEqual(
    p.definition,
    raw.resources[p.system].definition.complexEmitterDefinitionData[p.index]
  );
assert.equal(hash(frozen(audit.output.path)), audit.output.sha256);
const current = ledger.currentChecks;
assert.equal(json(current.export).enabled, 20);
assert.equal(json(current.ribbon).samples, 7);
assert.equal(json(current.ribbon).nativeExecuted, false);
const kernel = json(current.kernelEvidence);
assert.deepEqual(kernel.errors, []);
assert.equal(kernel.result.enabled, 20);
assert.equal(kernel.result.unchanged, true);
assert.deepEqual(kernel.result.original, kernel.result.restored);
assert.deepEqual(
  kernel.result.seen,
  Array.from({ length: 20 }, (_, i) => i)
);
for (const phase of kernel.result.phases) {
  assert.equal(phase.sameSave, true);
  assert.deepEqual(phase.original, phase.restored);
}
assert.equal(current.phaseEvidence.length, 4);
for (const file of current.phaseEvidence) {
  const phase = json(file);
  assert.deepEqual(phase.errors, []);
  assert.equal(phase.prepared.saved, phase.result.saved);
  assert.equal(phase.prepared.future, phase.result.future);
}
assert.match(readFileSync(current.standard, 'utf8'), /1782 passed \(1782\)/);
assert.match(readFileSync(current.standard, 'utf8'), /pass 3/);
assert.equal(ledger.acceptance.viewDrawingIntegrated, false);
assert.equal(ledger.acceptance.sourceEAudioIntegrated, false);
assert.equal(ledger.acceptance.nativeBehaviorVerified, false);
console.log(JSON.stringify({ result: 'passed', historical, enabled: 20, disabled: 13 }));
