import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const read = (name) => JSON.parse(readFileSync(name));
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
for (const optimized of [false, true])
  test(
    'R publication rejects altered inputs and partial writes ' +
      (optimized ? 'optimized' : 'normal'),
    () => {
      const result = JSON.parse(
        execFileSync(
          'python3',
          [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-r-publication.py'],
          { encoding: 'utf8', timeout: 90000 }
        )
      );
      assert.equal(result.result, 'passed');
      assert.equal(result.sourcePinMutations, 11);
      assert.equal(result.sharedAssets, 30);
      assert.equal(result.newPublicAssets, 25);
      assert.equal(result.privateInputsRequired, false);
      assert.equal(result.nativeParserRequired, false);
      assert.equal(result.partialWrites, false);
      assert.equal(result.borrowedSymlinkRejected, true);
    }
  );
test('Published R profiles retain all native declarations, field tags and unresolved requirements', () => {
  const content = read('src/content/ahri-r-particles.json');
  const source = read('docs/reference/ahri/r-particles.json');
  const types = new Map(
    read('docs/reference/ahri/r-native-types.json').resources.map((row) => [row.resourceKey, row])
  );
  const profiles = content.profiles;
  assert.equal(profiles.length, 55);
  assert.equal(new Set(profiles.map((p) => p.system + ':' + p.index)).size, 55);
  for (const profile of profiles) {
    const declaration =
      source.resources[profile.system].definition.complexEmitterDefinitionData[profile.index];
    assert.deepEqual(profile.sourceDeclaration, declaration);
    assert.deepEqual(
      profile.nativeFields,
      types.get(profile.system).emitters[profile.index].fields
    );
  }
  assert.equal(profiles.filter((p) => p.role === 'joined').length, 39);
  assert.equal(profiles.filter((p) => p.role === 'unjoined').length, 16);
  assert(profiles.some((p) => p.bindingRequirements.includes('native-palette-field')));
  assert(profiles.some((p) => p.bindingRequirements.includes('noise-field-arithmetic')));
  assert.deepEqual(source.nullResources, { Ahri_R_Transform_Out: '{00000000}' });
  assert.equal(profiles.filter((p) => p.system === 'Ahri_R_TextureSwaps').length, 0);
});
test('Every published R transport resolves to verified regular bytes and its native identity', () => {
  const content = read('src/content/ahri-r-particles.json');
  const source = read('docs/reference/ahri/r-particles.json');
  const record = read('docs/reference/ahri/r-publication.json');
  const assets = [...content.textures, ...content.meshes];
  const native = new Map(source.extraction.files.map((row) => [row.path, row]));
  assert.equal(content.textures.length, 51);
  assert.equal(content.meshes.length, 4);
  assert.equal(new Set(assets.map((row) => row.url)).size, 55);
  assert.equal(hash(readFileSync('src/content/ahri-r-particles.json')), record.publicProfileSha256);
  let addedFiles = 0,
    addedBytes = 0;
  for (const asset of assets) {
    assert.deepEqual(asset.source, native.get(asset.source.path));
    const path = resolve('public', asset.url);
    for (let component = path; component !== resolve('public'); component = dirname(component))
      assert.equal(lstatSync(component).isSymbolicLink(), false);
    const raw = readFileSync(path);
    assert.equal(raw.length, asset.bytes);
    assert.equal(hash(raw), asset.sha256);
    if ((asset.textureOwner ?? asset.geometryOwner) === 'ahri-r') {
      addedFiles++;
      addedBytes += raw.length;
    }
  }
  assert.equal(addedFiles, 25);
  assert.equal(addedBytes, 647809);
  assert.equal(record.sharedAssets.length, 30);
  assert.equal(record.newPublicAssetFiles, addedFiles);
  assert.equal(record.newPublicAssetBytes, addedBytes);
});
