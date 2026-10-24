/** Read-only Zenith source-package checks. Runtime E/native/full-goal acceptance is open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const text = (f) => readFileSync(f, 'utf8'),
  json = (f) => JSON.parse(text(f));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const ledger = json('docs/reference/leona/e-source-verification.json');
function verify(p, file = p.file) {
  const b = readFileSync(file);
  assert.equal(b.length, p.bytes, file);
  assert.equal(sha(b), p.sha256, file);
}
for (const archive of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const p of json(archive).files) {
    verify(p, p.archived);
    if (!historical && archive === ledger.sourceArchive) verify(p);
  }
for (const archive of ledger.preservedArchives)
  for (const p of json(archive).files) verify(p, p.archived ?? p.file);
for (const p of ledger.reviewInputs) {
  verify(p, p.archived);
  if (!historical) verify(p);
}
for (const p of ledger.evidence) verify(p);
if (!historical) for (const p of json(ledger.buildArchive).files) verify(p, 'dist/' + p.file);
const source = json(ledger.sourceArchive);
assert.equal(source.files.length, 1561);
assert.equal(source.schema, 124);
assert.equal(source.ruleset, ledger.ruleset);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const current = new Map(source.files.map((p) => [p.file, p.sha256]));
for (const p of json(ledger.runtimeBaselineArchive).files.filter((p) => p.file.startsWith('src/')))
  assert.equal(current.get(p.file), p.sha256, 'Unchanged runtime: ' + p.file);
const input = (file) => {
  const p = source.files.find((p) => p.file === file);
  assert(p);
  return json(p.archived);
};
const pin = input('docs/reference/leona-e-particles.json'),
  decoded = input('docs/reference/leona-e-particles-decoded.json');
assert.equal(Object.keys(pin.resources).length, 5);
assert.equal(pin.extraction.files.length, 50);
assert.equal(json(ledger.nativeArchive).files.length, 50);
assert.equal(decoded.textures.length, 42);
assert.equal(decoded.meshes.length, 4);
assert.equal(
  decoded.textures.reduce((n, t) => n + t.bytes, 0),
  569680
);
assert.equal(
  decoded.meshes.reduce((n, m) => n + m.output.bytes, 0),
  189016
);
const entries = Object.values(pin.resources).flatMap(
  (r) => r.definition.complexEmitterDefinitionData
);
assert.equal(entries.length, 33);
assert.equal(entries.filter((e) => !e.disabled).length, 20);
assert.equal(decoded.scope.visualEmitterRecords, 19);
assert.deepEqual(decoded.scope.soundOnlySystems, ['Leona_E_ZB_sfx_01']);
assert.deepEqual(decoded.pathResolutions, pin.pathResolutions);
assert.equal(pin.pathResolutions.length, 1);
assert.equal(pin.pathResolutions[0].wadPathHash, '97d68dc062eb5dfa');
assert.equal(pin.pathResolutions[0].binType, 'PATH (18)');
assert(decoded.textures.some((t) => t.source.wadPathHash === '97d68dc062eb5dfa'));
assert.equal(
  pin.resources.Leona_E_mis_dash.definition.materialOverrideDefinitions[0].baseTexture,
  '{97d68dc062eb5dfa}'
);
const cone = decoded.meshes.find(
  (m) => m.output.path === '/assets/models/leona-w-contact-cone.glb'
);
assert.deepEqual(
  cone,
  input('docs/reference/leona-w-particles-decoded.json').meshes.find(
    (m) => m.output.path === cone.output.path
  )
);
for (const m of decoded.meshes)
  assert.deepEqual(m.validation, { errors: 0, warnings: 0, roundTripAttributesExact: true });
assert.equal(decoded.acceptance.runtimeIntegrated, false);
assert.equal(decoded.acceptance.nativeRenderingVerified, false);
const c = ledger.checks;
assert.deepEqual(json(c.generatedDifferences).changed, ['offline-pack.json', 'offline-worker.js']);
assert.equal(json(c.generatedDifferences).unchangedGeneratedFiles, 31);
assert.match(text(c.unit), /1676 passed \(1676\)/);
assert.match(text(c.unit), /287 passed \(287\)/);
assert.equal(text(c.typecheck), '');
assert.match(text(c.nodeQa), /pass 3/);
assert.match(text(c.nodeQa), /fail 0/);
assert.match(text(c.browser), /1 passed/);
assert.match(text(c.build), /built in/);
const verified = json(c.nativeCheck),
  reproduction = json(c.reproduction);
assert.equal(verified.result, 'passed');
assert.equal(verified.sourceBytes, 1576679);
assert.equal(verified.textures, 42);
assert.equal(verified.meshes, 4);
assert.equal(verified.enabled, 20);
assert.equal(verified.disabled, 13);
assert.equal(reproduction.result, 'passed');
assert.equal(reproduction.check, true);
const browser = json(c.meshes);
assert.deepEqual(browser.errors, []);
assert.equal(browser.result.length, 4);
for (const [i, r] of browser.result.entries()) {
  assert.deepEqual(r.hashes, decoded.meshes[i].attributeSha256);
  assert.equal(r.indexed, false);
  assert.equal(r.drawnPositionSha256, decoded.meshes[i].attributeSha256.POSITION);
  assert.equal(r.vertices, decoded.meshes[i].exportedCorners);
  assert(r.visible > 0);
  assert(r.wireframeVisible > 0);
  assert.equal(r.triangleError, 0);
  assert.equal(r.error, 0);
}
const normal = json(c.currentNormal);
assert.equal(normal.result, 'passed');
assert.equal(normal.ruleset, ledger.ruleset);
assert.equal(normal.checkedTicks, 72000);
assert.equal(normal.hundredSeedInvariantGate, false);
const production = json(c.production),
  offline = json(c.offline),
  manifest = json(c.manifest);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.unrequestedLeonaPreloads, 0);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.deepEqual(offline.manifest, {
  id: manifest.id,
  files: manifest.files.length,
  bytes: manifest.bytes,
});
assert.equal(manifest.id, ledger.offlinePackId);
assert.equal(manifest.files.length, 939);
assert.equal(manifest.bytes, 506593617);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
assert.match(text(c.failedDiscovery), /needs an import attribute/);
assert.match(text(c.failedWireframe), /1 failed/);
const failed = json(c.failedMeshes);
assert(failed.result.every((r) => r.error === 1282 && r.visible === 0));
assert.equal(json(ledger.initialPin).extraction.files.length, 49);
assert(Object.values(ledger.acceptance).every((v) => v === false));
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 124,
    ruleset: ledger.ruleset,
    archivedInputs: source.files.length,
    nativeFiles: 50,
    systems: 5,
    emitterRecords: 33,
    enabledEmitters: 20,
    visualEmitters: 19,
    disabledEmitters: 13,
    textures: 42,
    meshes: 4,
    unitTests: 1676,
    browserCases: 1,
    offlineFiles: manifest.files.length,
    ...ledger.acceptance,
  })
);
