/** Offline bounded discovery audit; it performs no network or native execution. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const pin = json('docs/reference/leona-native-client-discovery.json');
for (const p of pin.files) {
  const b = readFileSync(p.path);
  assert.equal(b.length, p.bytes, p.path);
  assert.equal(createHash('sha256').update(b).digest('hex'), p.sha256, p.path);
}
const path = (suffix) => pin.files.find((p) => p.path.endsWith('/' + suffix)).path;
assert.equal(json(path('target-content-metadata.json')).version, pin.targetContentVersion);
assert(pin.targetContentVersion.startsWith('16.18.8175716+'));
const inventory = json(path('target-inventory.json')).files;
assert.equal(inventory.length, 4048);
assert.equal(inventory.length, pin.targetAssetsFileCount);
assert.deepEqual(
  inventory
    .filter((p) => !p.name.toLowerCase().endsWith('.wad.client'))
    .map((p) => p.name)
    .sort(),
  ['compat-version-metadata.json', 'content-metadata.json']
);
for (const platform of ['macos', 'windows']) {
  const r = json(path(`current-native-${platform}.json`)).releases;
  assert.equal(r.length, 1);
  assert.equal(r[0].release.id, pin.currentNativeManifestIds[platform]);
  assert.deepEqual(r[0].release.labels['riot:artifact_type_id'].values, ['lol-game-client']);
  assert.deepEqual(r[0].release.labels.platform.values, [platform]);
  assert(r[0].release.labels['riot:artifact_version_id'].values[0].startsWith('16.21.8298620+'));
  assert(!r[0].compat_version.id.startsWith('16.18.8175716+'));
}
let officialRoutes = 0;
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (
    value.id === 'game_client' &&
    value.type === 'patchsieve' &&
    value.patchsieve.parameters.artifact_type_id === 'lol-game-client'
  )
    officialRoutes++;
  for (const child of Object.values(value)) visit(child);
}
visit(json(path('clientconfig.json')));
assert(officialRoutes > 0);
for (const p of pin.files.filter((p) => p.path.includes('historical-query-')))
  assert.equal(p.status, 400);
assert.equal(pin.matchingNativeManifestIdentified, false);
assert.equal(pin.nativeExecuted, false);
console.log(
  JSON.stringify({
    result: 'passed',
    target: pin.targetContentVersion,
    assetFiles: inventory.length,
    matchingNativeManifestIdentified: false,
    nativeExecuted: false,
  })
);
