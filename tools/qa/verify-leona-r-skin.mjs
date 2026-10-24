/** Frozen attached-skin acceptance; native CPU/frame correspondence remains open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
  ledger = json('docs/reference/leona/r-skin-verification.json'),
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
  shaders = json(frozen('docs/reference/leona-r-skin-shaders.json')),
  readers = json(frozen('docs/reference/leona-r-skin-readers.json')),
  map = new Map([...ledger.readers, ...ledger.native].map((p) => [p.file, p]));
assert.equal(readers.files.length, 16);
for (const p of readers.files) assert.equal(map.get(p.path).sha256, p.sha256, p.path);
assert.equal(shaders.selections.length, 8);
assert.equal(shaders.nativeExecuted, false);
assert.equal(shaders.nativeCpuVerified, false);
for (const p of shaders.selections) {
  assert.equal(map.get(p.table).sha256, p.tableSha256);
  assert.equal(map.get(p.bundle).sha256, p.bundleSha256);
  const raw = readFileSync(map.get(p.metallib.path).archived),
    bundle = readFileSync(map.get(p.bundle).archived),
    bc = readFileSync(map.get(p.bitcode.path).archived);
  assert.equal(bundle.readUInt32LE(p.bundleProgramOffset - 4), raw.length);
  assert(raw.equals(bundle.subarray(p.bundleProgramOffset, p.bundleProgramOffset + raw.length)));
  assert(bc.equals(raw.subarray(p.bitcode.offset, p.bitcode.offset + bc.length)));
  for (const kind of ['metallib', 'bitcode', 'disassembly'])
    assert.equal(map.get(p[kind].path).sha256, p[kind].sha256);
}
const c = ledger.checks,
  standard = readFileSync(c.standard, 'utf8');
assert.match(standard, /1858 passed \(1858\)/);
assert.match(standard, /306 passed \(306\)/);
assert.match(standard, /pass 3/);
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
assert.match(readFileSync(c.browser, 'utf8'), /17 passed/);
const gpu = json(c.products);
assert.deepEqual(gpu.errors, []);
assert.equal(gpu.cases.length, 84);
const clamp = (v) => Math.min(1, Math.max(0, v));
for (const [i, r] of gpu.results.entries()) {
  const o = gpu.cases[i],
    u = o.source.map((v, j) => ((v / 255) * o.multiplier[j]) / 255),
    t = u.map((v, j) => v * o.tint[j]),
    rgb = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v) => v / 255) : t.slice(0, 3),
    rim = 1 - Math.pow(o.facing, o.power),
    expected = [...rgb.map((v, j) => clamp(v + rim * o.rim[j] * u[3])), t[3]].map((v) =>
      Math.round(v * 255)
    );
  assert.equal(r.error, 0);
  for (let j = 0; j < 4; j++) assert(Math.abs(r.pixels[j] - expected[j]) <= 1);
}
const alpha = json(c.alphaUv);
assert.deepEqual(alpha.errors, []);
assert.equal(alpha.results.length, 4);
assert(alpha.results.every((r) => r.error === 0));
assert.deepEqual(alpha.results[1].pixels, alpha.results[2].pixels);
assert.notDeepEqual(alpha.results[2].pixels, alpha.results[3].pixels);
assert.deepEqual(
  alpha.uvResults.map((r) => r.pixels),
  [
    [255, 0, 0, 64],
    [0, 255, 0, 128],
  ]
);
const float = json(c.floatRecovery);
assert.deepEqual(float.errors, []);
assert.deepEqual(float.before, float.recovered);
assert.deepEqual(float.before.pixels, [1, 1, 1, 2]);
assert.equal(float.before.error, 0);
const pose = json(c.pose);
assert.deepEqual(pose.errors, []);
assert.deepEqual(pose.before, pose.restored);
assert.equal(pose.before.models.length, 1);
assert(pose.visible.changed > 10 && pose.visible.changed < pose.visible.totalPixels * 0.1);
assert.equal(pose.visible.error, 0);
const model = pose.before.models[0];
assert.equal(model.profileIndex, 0);
assert.equal(model.attachment, 'saved-owner-skin');
assert.equal(model.lockMeshToAttachment, true);
assert.deepEqual(model.ownerScale, [1.0099999904632568, 1.0099999904632568, 1.0099999904632568]);
assert.deepEqual(model.wraps, [1000, 1000]);
assert.equal(model.alphaRef, 5 / 255);
const saved = JSON.parse(pose.before.snapshot);
assert.equal(saved.version, 126);
assert.equal(saved.ruleset, ledger.ruleset);
const recovery = json(c.rigRecovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.before, recovery.recovered);
assert.deepEqual(recovery.released, { models: 0, material: 1, bone: 1, borrowed: 0 });
const storage = json(c.storage);
assert.equal(storage.length, 6);
assert(storage.every((r) => r.active === 1 && r.remaining === 0));
assert(
  storage.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(storage[1].memory))
);
const nativeCheck = json(c.nativeCheck);
assert.equal(nativeCheck.result, 'passed');
assert.equal(nativeCheck.programs, 8);
assert.equal(nativeCheck.streams, 24);
assert.equal(nativeCheck.defineHashesRecomputed, true);
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
assert.equal(ledger.acceptance.sourceRSkinsIntegrated, true);
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
    sourceAttachedFamilies: 1,
    totalIntegratedFamilies: 36,
    shaderProbes: 84,
    browserCases: 17,
    files: ledger.pack.files,
    ruleset: ledger.ruleset,
  })
);
