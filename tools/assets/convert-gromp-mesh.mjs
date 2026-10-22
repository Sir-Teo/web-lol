/** Package the source paper shard geometry, retaining UV seams and metadata. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-gromp-mesh.py'], {
  stdio: 'inherit',
});
const source = JSON.parse(await readFile('.cache/gromp-effects-mesh.json')),
  hash = (raw) => createHash('sha256').update(raw).digest('hex'),
  document = new Document(),
  buffer = document.createBuffer(),
  attribute = (type, values) =>
    document.createAccessor().setType(type).setArray(values).setBuffer(buffer),
  positions = Float32Array.from(source.positions, (v) => v * 0.01),
  uv = new Float32Array(source.uv),
  colors = new Uint8Array(source.sourceFaceRGB);
const primitive = document
  .createPrimitive()
  .setAttribute('POSITION', attribute('VEC3', positions))
  .setAttribute('TEXCOORD_0', attribute('VEC2', uv))
  .setAttribute('_SOURCE_FACE_RGB', attribute('VEC3', colors).setNormalized(true));
const metadata = Object.fromEntries(
  Object.entries(source).filter(([key]) => !['positions', 'uv', 'sourceFaceRGB'].includes(key))
);
document
  .createScene()
  .addChild(
    document
      .createNode('Gromp death paper shard')
      .setMesh(document.createMesh('paper01').addPrimitive(primitive))
  )
  .setExtras({
    ...metadata,
    unitScale: 0.01,
    note: 'Original face corners, positions, UVs and raw face RGB retained. No pivot offset, winding change, reflection, emitter transform or particle material applied. Raw face RGB is not a runtime tint.',
  });
document.getRoot().getAsset().copyright = 'Gromp artwork © Riot Games. Reference content.';
const io = new NodeIO(),
  bytes = await io.writeBinary(document),
  report = await validator.validateBytes(bytes);
assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
for (const name of ['POSITION', 'TEXCOORD_0', '_SOURCE_FACE_RGB'])
  assert.deepEqual(restored.getAttribute(name).getArray(), primitive.getAttribute(name).getArray());
assert.equal(restored.getIndices(), null);
const path = 'public/assets/models/gromp-death-paper01.glb';
await writeFile(path, bytes);
const manifest = {
  ...metadata,
  output: { path: path.replace('public', ''), bytes: bytes.length, sha256: hash(bytes) },
  exportedCorners: positions.length / 3,
  unitScale: 0.01,
  positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
  uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
  faceRgbSha256: hash(colors),
  validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
};
await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({ path, bytes: bytes.length, triangles: source.triangles, validated: true })
);
