/** Source mesh packaging only; emitter transforms and native VCP semantics remain unresolved. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import validator from 'gltf-validator';
execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-lux-crescent.py'], {
  stdio: 'inherit',
});
const data = JSON.parse(await readFile('.cache/lux-basic-attack/crescent.json'));
const pin = JSON.parse(await readFile('docs/reference/lux-basic-attack.json'));
const emitter = pin.data.complexEmitterDefinitionData.find(
  (e) => e.emitterName === 'crescentwhite'
);
const image = pin.textures.find((t) => t.path === emitter.texture.toLowerCase());
const hash = (b) => createHash('sha256').update(b).digest('hex');
const doc = new Document(),
  buffer = doc.createBuffer();
const accessor = (type, array) =>
  doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const unlit = doc.createExtension(KHRMaterialsUnlit);
const texture = doc
  .createTexture('Source Ring04')
  .setMimeType('image/png')
  .setImage(await readFile(image.output));
const material = doc
  .createMaterial('crescentwhite source texture')
  .setBaseColorTexture(texture)
  .setAlphaMode('BLEND')
  .setExtension('KHR_materials_unlit', unlit.createUnlit())
  .setExtras({
    note: 'Source VCP retained as custom attribute; blend and color-lookup semantics not implemented.',
  });
const primitive = doc
  .createPrimitive()
  .setAttribute(
    'POSITION',
    accessor(
      'VEC3',
      Float32Array.from(data.positions, (v) => v * 0.01)
    )
  )
  .setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(data.uv)))
  .setAttribute(
    '_SOURCE_FACE_RGB',
    accessor('VEC3', new Uint8Array(data.sourceFaceRGB)).setNormalized(true)
  )
  .setIndices(
    accessor(
      'SCALAR',
      Uint16Array.from(data.sourceIndices, (_, i) => i)
    )
  )
  .setMaterial(material);
const mesh = doc.createMesh('Lux basic attack source crescent').addPrimitive(primitive);
doc.createScene().addChild(doc.createNode('crescentwhite').setMesh(mesh)).setExtras({
  unitScale: 0.01,
  sourceEmitter: emitter,
  sourceCentralPoint: data.centralPoint,
  sourceBounds: data.sourceBounds,
  sourceFlags: data.flags,
  sourceName: data.sourceName,
  uninterpretedTailHex: data.uninterpretedTailHex,
  note: 'Source coordinates preserved; central point, tail and emitter transforms are not applied.',
});
doc.getRoot().getAsset().copyright = 'Lux artwork © Riot Games. Reference content.';
const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]);
const bytes = await io.writeBinary(doc),
  validation = await validator.validateBytes(bytes);
assert.equal(validation.issues.numErrors, 0, JSON.stringify(validation.issues));
assert.equal(validation.issues.numWarnings, 0, JSON.stringify(validation.issues));
const restored = await io.readBinary(bytes),
  decoded = restored.getRoot().listMeshes()[0].listPrimitives()[0];
for (const name of ['POSITION', 'TEXCOORD_0', '_SOURCE_FACE_RGB'])
  assert.deepEqual(decoded.getAttribute(name).getArray(), primitive.getAttribute(name).getArray());
assert.deepEqual(decoded.getIndices().getArray(), primitive.getIndices().getArray());
assert.equal(hash(restored.getRoot().listTextures()[0].getImage()), image.pngSha256);
const path = 'public/assets/models/lux-basic-crescent.glb';
await writeFile(path, bytes);
const manifest = {
  status: 'Verified source packaging, not complete runtime particle fidelity.',
  output: {
    path: '/assets/models/lux-basic-crescent.glb',
    bytes: bytes.length,
    sha256: hash(bytes),
  },
  sourcePinSha256: hash(await readFile('docs/reference/lux-basic-attack.json')),
  source: data.source,
  sourceVertices: data.sourceVertices,
  triangles: data.triangles,
  unitScale: 0.01,
  centralPoint: data.centralPoint,
  uninterpretedTailHex: data.uninterpretedTailHex,
  auxiliaryAssets: pin.textures.map((t) => ({
    path: t.output.replace('public', ''),
    bytes: t.bytes,
    sha256: t.pngSha256,
  })),
  validation: {
    errors: validation.issues.numErrors,
    warnings: validation.issues.numWarnings,
    roundTripAttributesExact: true,
  },
};
await writeFile(
  'public/assets/models/lux-basic-crescent.json',
  JSON.stringify(manifest, null, 2) + '\n'
);
console.log(JSON.stringify(manifest));
