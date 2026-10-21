import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

const data = JSON.parse(await readFile('.cache/garen-spin/mesh.json'));
const audit = JSON.parse(await readFile('docs/reference/garen-spin.json'));
const doc = new Document(),
  buffer = doc.createBuffer();
const attr = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const primitive = doc
  .createPrimitive()
  .setAttribute(
    'POSITION',
    attr(
      'VEC3',
      Float32Array.from(data.positions, (v) => v * 0.01)
    )
  )
  .setAttribute('TEXCOORD_0', attr('VEC2', new Float32Array(data.uv)))
  .setAttribute(
    '_SOURCE_FACE_RGB',
    attr('VEC3', new Uint8Array(data.sourceFaceRGB)).setNormalized(true)
  );
const mesh = doc.createMesh('Garen Judgment source mesh').addPrimitive(primitive);
doc.createScene().addChild(doc.createNode('Judgment').setMesh(mesh)).setExtras({
  source: data.source,
  unitScale: 0.01,
  pivot: data.pivot,
  bounds: data.bounds,
  flags: data.flags,
  tailHex: data.tailHex,
  note: 'Source coordinates retained. Face RGB, central point and tail are retained without guessed interpretation.',
});
doc.getRoot().getAsset().copyright = 'Garen artwork © Riot Games. Reference content.';
const io = new NodeIO(),
  bytes = await io.writeBinary(doc);
const validation = await validator.validateBytes(bytes);
assert.equal(validation.issues.numErrors, 0, JSON.stringify(validation.issues));
assert.equal(validation.issues.numWarnings, 0, JSON.stringify(validation.issues));
const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
for (const key of ['POSITION', 'TEXCOORD_0', '_SOURCE_FACE_RGB'])
  assert.deepEqual(restored.getAttribute(key).getArray(), primitive.getAttribute(key).getArray());
const path = 'public/assets/models/garen-spin.glb';
await writeFile(path, bytes);
await writeFile(
  'public/assets/models/garen-spin.json',
  JSON.stringify(
    {
      output: {
        path: path.replace('public', ''),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      source: data.source,
      auxiliaryAssets: audit.textures.map((t) => ({
        path: t.path.replace('public', ''),
        bytes: t.bytes,
        sha256: t.sha256,
      })),
      sourceVertices: data.vertices,
      triangles: data.triangles,
      validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
    },
    null,
    2
  ) + '\n'
);
console.log(`Verified Judgment mesh: ${data.triangles} triangles, ${bytes.length} bytes`);
