/** Frozen local early R composition acceptance, separate from native CPU/frame parity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-early-distortion-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [
  ...source,
  ...ledger.generated,
  ...ledger.readers,
  ...ledger.native,
  ...ledger.evidence,
]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (p) => source.find((r) => r.file === p).archived,
  readers = json(frozen('docs/reference/leona-r-early-distortion-readers.json')),
  inputs = new Map(ledger.readers.map((p) => [p.file, p]));
assert.equal(readers.files.length, 7);
for (const p of readers.files) assert.equal(inputs.get(p.path).sha256, p.sha256);
const reading = json(frozen('docs/reference/leona-r-early-distortion-reading.json'));
assert.equal(reading.nativeExecuted, false);
assert.deepEqual(reading.localIntegration.families, [27, 30, 33]);
const pin = json(frozen('docs/reference/particle-distortion-shaders.json')),
  native = new Map(ledger.native.map((p) => [p.file, p]));
assert.equal(pin.programs.length, 15);
for (const p of pin.provenance.files)
  assert.equal(native.get('.cache/particle-distortion-shaders/native/' + p.path).sha256, p.sha256);
for (const p of pin.programs) {
  const bundle = readFileSync(
      native.get('.cache/particle-distortion-shaders/native/' + p.table + '_0').archived
    ),
    metal = readFileSync(native.get(p.metallib.path).archived),
    bc = readFileSync(native.get(p.bitcode.path).archived);
  let at = 0,
    index = 0,
    found = false;
  while (at < bundle.length) {
    const size = bundle.readUInt32LE(at);
    at += 4;
    assert(size > 0 && at + size <= bundle.length);
    if (index === p.index) {
      assert(metal.equals(bundle.subarray(at, at + size)));
      found = true;
    }
    at += size;
    index++;
  }
  assert(found);
  assert.equal(at, bundle.length);
  assert(bc.equals(metal.subarray(p.bitcode.offset, p.bitcode.offset + bc.length)));
  for (const kind of ['metallib', 'bitcode', 'disassembly'])
    assert.equal(native.get(p[kind].path).sha256, p[kind].sha256);
}
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1881 passed \(1881\)/);
assert.match(standard, /309 passed \(309\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.qaTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /24 passed/);
const nativeCheck = json(c.nativeCheck);
assert.equal(nativeCheck.result, 'passed');
assert.equal(nativeCheck.programs, 15);
assert.equal(nativeCheck.defineHashesRecomputed, true);
assert.equal(nativeCheck.nativeExecuted, false);
const phase = json(c.phase);
assert.deepEqual(phase.before, phase.recovered);
assert.deepEqual(phase.before.early, [
  [0, 0, 255, 255],
  [255, 0, 0, 255],
]);
assert.deepEqual(phase.before.late, [
  [255, 0, 0, 255],
  [255, 0, 0, 255],
]);
assert.equal(phase.before.same, true);
assert.equal(phase.before.error, 0);
assert.deepEqual(phase.before.retired, { early: true, late: true });
const capture = json(c.capture);
assert.equal(capture.earlyCopies, 1);
assert.equal(capture.lateCopies, 1);
assert.equal(capture.unchanged, true);
assert.equal(capture.error, 0);
assert.deepEqual(
  capture.state.map((m) => m.profile),
  [27, 30, 33]
);
assert(capture.state.every((m) => m.shared && !m.depthTest && !m.alphaTest));
assert(capture.contributions.every((p) => p.changed > 10));
assert.equal(c.families.length, 2);
assert.equal(c.restores.length, 2);
for (const path of c.families) {
  const f = json(path);
  assert.deepEqual(f.errors, []);
  assert.equal(f.seen.length, 33);
  assert(f.seen.every(([, changed]) => changed > 0));
  for (const profile of [27, 30, 33]) assert(f.seen.find(([i]) => i === profile)?.[1] > 10);
}
for (const path of c.restores) {
  const f = json(path);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.before, f.restored);
  assert.deepEqual(f.before, f.recovered);
  const w = JSON.parse(f.before.snapshot);
  assert.equal(w.version, 126);
  assert.equal(w.ruleset, ledger.ruleset);
}
const storage = json(c.storage);
assert.deepEqual(storage.errors, []);
assert.equal(storage.rounds.length, 6);
assert(
  storage.rounds.every(
    (r) =>
      r.copyActive &&
      r.earlyActive &&
      !r.copyRemaining &&
      !r.earlyRemaining &&
      r.remaining === 0 &&
      r.materials === r.active &&
      r.geometry >= r.owned
  )
);
assert(
  storage.rounds
    .slice(1)
    .every((r) => JSON.stringify(r.memory) === JSON.stringify(storage.rounds[1].memory))
);
for (const path of [c.wComparison, c.eComparison]) {
  const f = json(path);
  assert.deepEqual(f.errors, []);
  assert.equal(f.samples.length, 63);
  assert(f.samples.every((p) => p.different === 0 && p.stateEqual && p.error === 0));
}
const gpu = json(c.nativeGpu),
  copy = json(c.nativeCopy),
  recovery = json(c.nativeRecovery),
  depth = json(c.nativeDepth);
assert.equal(gpu.cases.length, 12);
assert(gpu.cases.every((p) => p.maxDelta <= 2 && p.calls === 2));
assert(gpu.perspective.maxDelta <= 2 && gpu.perspective.naiveWitness > 5);
assert(copy.cases.every((p) => p.delta === 0));
assert.deepEqual(recovery.after, { different: 0, recreated: true, empty: true, unchanged: true });
assert.deepEqual(depth.kept, depth.before);
assert(depth.through[1] > 40 && depth.through[2] > 40);
const production = readFileSync(c.production, 'utf8')
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((p) => p?.recordings);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline),
  pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, ledger.pack.id);
assert.equal(pack.files.length, ledger.pack.files);
assert.equal(pack.bytes, ledger.pack.bytes);
assert.equal(offline.manifest.id, pack.id);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
for (const p of pack.files) {
  const file =
    ledger.generated.find((r) => r.file === `dist/${p.path}`)?.archived ??
    source.find((r) => r.file === `public/${p.path}`)?.archived;
  assert(file, p.path);
  assert.equal(hash(file), p.sha256);
  assert.equal(readFileSync(file).length, p.bytes);
}
assert.equal(ledger.acceptance.sourceREarlyIntegrated, true);
for (const key of [
  'sourceRComplete',
  'nativeCpuVerified',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    totalIntegratedFamilies: 41,
    earlyFamilies: 3,
    browserCases: 24,
    nativePrograms: 15,
    files: ledger.pack.files,
    ruleset: ledger.ruleset,
  })
);
