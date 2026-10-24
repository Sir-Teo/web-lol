/** Frozen local decal address acceptance; generic native evidence is separately bounded. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-native-sampler-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.generated, ...ledger.native, ...ledger.evidence]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
  execFileSync('python3', ['tools/assets/verify-leona-native-particle-bindings.py', '--check']);
}
const frozen = (p) => source.find((r) => r.file === p).archived,
  native = json(frozen('docs/reference/leona-native-particle-bindings.json'));
assert.equal(native.nativeExecuted, false);
assert.equal(native.nativeShaderExecuted, false);
assert.equal(native.rawProviderFiles.length, 25);
assert.equal(native.instructionSpans.length, 38);
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1881 passed \(1881\)/);
assert.match(standard, /309 passed \(309\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.qaTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /14 passed/);
assert.match(readFileSync(c.native, 'utf8'), /25 raw Hopper records, 38 byte spans/);
assert.equal(c.projectors.length, 2);
for (const path of c.projectors) {
  const p = json(path);
  assert.deepEqual(p.errors, []);
  assert.equal(p.before.models.length, 1);
  assert.deepEqual(p.before, p.restored);
  assert.equal(p.before.snapshot, p.prepared.snapshot);
  const w = JSON.parse(p.before.snapshot);
  assert.equal(w.version, 126);
  assert.equal(w.ruleset, ledger.ruleset);
  assert.deepEqual(
    p.before.models[0].samplers,
    Array.from({ length: 2 }, () => ({
      wrapS: 1001,
      wrapT: 1001,
      min: 1006,
      mag: 1006,
      mipmaps: false,
    }))
  );
  assert(p.visible.changed > 10000 && p.visible.error === 0);
}
const recovery = json(c.projectorRecovery);
assert.deepEqual(recovery.before, recovery.recovered);
assert.equal(recovery.rounds.length, 6);
assert(
  recovery.rounds.every(
    (r) => r.remaining === 0 && r.geometry === 1 && r.material === 1 && r.borrowed === 0
  )
);
assert(
  recovery.rounds
    .slice(1)
    .every((r) => JSON.stringify(r.memory) === JSON.stringify(recovery.rounds[1].memory))
);
const rift = json(c.rift);
assert.equal(rift.result.lazy, 0);
assert.equal(rift.result.before, rift.result.after);
assert.equal(rift.result.error, 0);
assert(rift.visible.changed > 0 && rift.visible.error === 0);
for (const path of c.families) {
  const f = json(path);
  assert.deepEqual(f.errors, []);
  assert.equal(f.seen.length, 33);
  assert(f.seen.every(([, changed]) => changed > 0));
}
const early = json(c.early);
assert.equal(early.earlyCopies, 1);
assert.equal(early.lateCopies, 1);
assert(early.unchanged && early.error === 0);
assert(early.contributions.every((p) => p.changed > 10));
const decal = json(c.decal);
assert.equal(decal.reports.length, 640);
assert(decal.reports.every((p) => p.error <= 2));
assert.deepEqual(decal.before, decal.after);
assert.equal(decal.error, 0);
assert.deepEqual(decal.errors, []);
const assets = json(c.staticAssets);
assert.equal(assets.staticFilesCompared, 965);
assert.deepEqual(assets.changed, []);
const production = readFileSync(c.production, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('{"result":"passed","prefix":'));
assert(production);
const p = JSON.parse(production);
assert.equal(p.recordings, 32);
assert.equal(p.developmentHook, false);
assert.equal(p.unrequestedLeonaPreloads, 0);
const offline = json(c.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack.id);
assert.equal(offline.manifest.files, 1011);
assert.equal(offline.manifest.bytes, 513276626);
assert.equal(offline.checks.serviceWorkerResponses, 963);
assert(
  Object.entries(offline.checks).every(([k, v]) => k === 'serviceWorkerResponses' || v === true)
);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    browserCases: 14,
    integratedRFamilies: 41,
    nativeRawRecords: 25,
    nativeInstructionSpans: 38,
    files: 1011,
    ruleset: ledger.ruleset,
  })
);
