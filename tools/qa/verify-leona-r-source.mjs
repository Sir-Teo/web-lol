/** Frozen source package; no runtime/native R acceptance is inferred. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const ledger = json('docs/reference/leona/r-source-verification.json'),
  source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated, ...ledger.native]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (file) => source.find((p) => p.file === file).archived;
const pin = json(frozen('docs/reference/leona-r-particles.json')),
  decoded = json(frozen('docs/reference/leona-r-particles-decoded.json'));
assert.equal(decoded.sourcePinSha256, hash(frozen('docs/reference/leona-r-particles.json')));
assert.equal(Object.keys(pin.resources).length, 6);
const records = Object.values(pin.resources).flatMap(
  (r) => r.definition.complexEmitterDefinitionData
);
assert.equal(records.length, 53);
assert.equal(records.filter((e) => !e.disabled).length, 44);
assert.equal(records.filter((e) => e.disabled).length, 9);
assert.equal(decoded.textures.length, 41);
assert.equal(decoded.meshes.length, 4);
for (const t of decoded.textures) {
  assert.equal(hash(frozen(t.path)), t.sha256);
  assert.equal(readFileSync(frozen(t.path)).length, t.bytes);
}
for (const m of decoded.meshes) {
  assert.equal(hash(frozen('public' + m.output.path)), m.output.sha256);
  assert.equal(Object.hasOwn(m.attributeSha256, 'NORMAL'), false);
  assert.deepEqual(m.validation, { errors: 0, warnings: 0, roundTripAttributesExact: true });
}
const native = new Map(ledger.native.map((p) => [p.file, p]));
assert.equal(native.size, 49);
for (const p of pin.extraction.files) {
  assert.equal(native.get(p.path).sha256, p.sha256);
  assert.equal(native.get(p.path).bytes, p.bytes);
}
const c = ledger.checks;
for (const file of [c.extract, c.decode]) {
  const d = json(file);
  assert.equal(d.result, 'passed');
  assert.equal(d.systems, 6);
  assert.equal(d.emitters, 53);
  assert.equal(d.enabled, 44);
  assert.equal(d.disabled, 9);
  assert.equal(d.textures, 41);
  assert.equal(d.meshes, 4);
  assert.equal(d.runtimeIntegrated, false);
  assert.equal(d.nativeRenderingVerified, false);
}
const convert = json(c.convert);
assert.equal(convert.result, 'passed');
assert.equal(convert.check, true);
assert.equal(convert.meshBytes, 125824);
assert.match(readFileSync(c.standard, 'utf8'), /1815 passed \(1815\)/);
assert.match(readFileSync(c.standard, 'utf8'), /299 passed \(299\)/);
assert.match(readFileSync(c.standard, 'utf8'), /pass 3/);
assert.match(readFileSync(c.browser, 'utf8'), /1 passed/);
const gpu = json(c.geometry);
assert.deepEqual(gpu.errors, []);
assert.equal(gpu.result.length, 4);
for (const [i, p] of gpu.result.entries()) {
  const m = decoded.meshes[i];
  assert.equal(p.path, m.output.path);
  assert.deepEqual(p.hashes, m.attributeSha256);
  assert.equal(p.vertices, m.exportedCorners);
  assert.equal(p.indexed, false);
  assert(p.visible > 0);
  assert(p.wireframeVisible > 0);
  assert.equal(p.drawnPositionSha256, m.attributeSha256.POSITION);
  assert.equal(p.triangleError, 0);
  assert.equal(p.error, 0);
}
const production = readFileSync(c.production, 'utf8')
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
const offline = json(c.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
const pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, offline.manifest.id);
assert.equal(pack.files.length, 996);
assert.equal(pack.bytes, 510449057);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const p of pack.files) {
  const archived =
    ledger.generated.find((x) => x.file === `dist/${p.path}`)?.archived ??
    source.find((x) => x.file === `public/${p.path}`)?.archived;
  assert(archived, p.path);
  assert.equal(hash(archived), p.sha256, p.path);
  assert.equal(readFileSync(archived).length, p.bytes, p.path);
}
assert.equal(ledger.acceptance.sourcePackageReady, true);
for (const key of [
  'runtimeIntegrated',
  'sourceRAudioIntegrated',
  'nativeRenderingVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    systems: 6,
    enabled: 44,
    disabled: 9,
    files: pack.files.length,
    runtimeIntegrated: false,
  })
);
