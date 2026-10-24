/** Current or historical arrival-skin evidence; other E families remain open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ledger = json('docs/reference/leona/e-skin-verification.json');
const source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (file) => source.find((p) => p.file === file).archived;
const profile = json(frozen('src/content/leona-e-particles.json')).profiles;
assert.equal(profile.filter((p) => p.kind === 'skin').length, 1);
assert.equal(profile[5].name, 'Avatar_Burst');
assert.equal(profile[5].reflection, null);
assert.equal(profile[5].uv.address, 0);
assert.equal(profile[5].erosion.address, 1);
const arrival = json(ledger.browser.arrival);
assert.deepEqual(arrival.errors, []);
assert.deepEqual(arrival.before, arrival.restored);
assert.equal(arrival.before.snapshot, arrival.prepared.snapshot);
assert.equal(arrival.before.models.length, 1);
assert.equal(arrival.before.models[0].profileIndex, 5);
assert.deepEqual(arrival.before.models[0].wraps, [1000, 1002]);
assert(arrival.visible.changed > 100);
assert(arrival.visible.changed < arrival.visible.totalPixels * 0.1);
assert.equal(arrival.visible.error, 0);
const recovery = json(ledger.browser.recovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.before, recovery.recovered);
assert.deepEqual(recovery.released, { models: 0, material: 1, bone: 1, borrowed: 0 });
const rounds = json(ledger.browser.storage);
assert.equal(rounds.length, 6);
assert(rounds.every((r) => r.active === 1 && r.remaining === 0));
for (const r of rounds.slice(1)) assert.deepEqual(r.memory, rounds[1].memory);
assert.equal(ledger.phaseEvidence.length, 4);
for (const file of ledger.phaseEvidence) {
  const d = json(file);
  assert.deepEqual(d.errors, []);
  assert.equal(d.prepared.saved, d.result.saved);
  assert.equal(d.prepared.future, d.result.future);
}
const production = readFileSync(ledger.production, 'utf8')
  .trim()
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((d) => d?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(ledger.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert.equal(value, 963);
  else assert.equal(value, true, key);
const pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, offline.manifest.id);
assert.equal(pack.files.length, 942);
assert.equal(pack.bytes, 506711186);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const p of pack.files) {
  const generated = ledger.generated.find((x) => x.file === `dist/${p.path}`),
    input = source.find((x) => x.file === `public/${p.path}`),
    archived = generated?.archived ?? input?.archived;
  assert(archived, p.path);
  assert.equal(hash(archived), p.sha256, p.path);
  assert.equal(readFileSync(archived).length, p.bytes);
}
assert.match(readFileSync(ledger.standard, 'utf8'), /1790 passed \(1790\)/);
assert.match(readFileSync(ledger.standard, 'utf8'), /pass 3/);
assert.equal(ledger.acceptance.arrivalSkinIntegrated, true);
assert.equal(ledger.acceptance.otherEPrimitivesIntegrated, false);
assert.equal(ledger.acceptance.nativeFrameVerified, false);
assert.equal(ledger.acceptance.fullProjectComplete, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    arrivalSkin: true,
    pack: pack.id,
    files: pack.files.length,
  })
);
