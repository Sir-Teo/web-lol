/** Stage the selected native Q target mesh. No public assets or runtime binding. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

execFileSync('python', ['tools/assets/decode-masteryi-q-particles.py', '--check'], {
  stdio: 'inherit',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordBytes = await readFile('docs/reference/masteryi/q-particles-decoded.json');
assert.equal(hash(recordBytes), '783317cf9c44a36b3e07fbda8d27829ec6ae674119fcb5c8fddac46a959360fd');
const source = JSON.parse(recordBytes).meshes.find(
  (m) => m.source.wadPathHash === '51536e0eac6b2592'
);
const raw = await readFile(source.path);
assert.equal(raw.length, source.bytes);
assert.equal(hash(raw), source.sha256);
const mesh = JSON.parse(raw);
assert.equal(mesh.triangles, 1500);
assert.equal(mesh.sourceVertices, 750);
assert.equal(mesh.flags, 5);
const positions = new Float32Array(mesh.sourceIndices.length * 3);
const uv = new Float32Array(mesh.sourceIndices.length * 2);
mesh.sourceIndices.forEach((index, corner) => {
  mesh.sourcePoints[index].forEach((value, axis) => {
    positions[corner * 3 + axis] = value * 0.01;
  });
  const face = Math.floor(corner / 3),
    local = corner % 3;
  uv[corner * 2] = mesh.faceUv[face][local];
  uv[corner * 2 + 1] = mesh.faceUv[face][local + 3];
});
const colors = new Uint8Array(Buffer.from(mesh.sourceFaceRgbHex, 'hex'));
assert.equal(colors.length, mesh.sourceIndices.length * 3);
const doc = new Document(),
  buffer = doc.createBuffer();
const attr = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const primitive = doc
  .createPrimitive()
  .setAttribute('POSITION', attr('VEC3', positions))
  .setAttribute('TEXCOORD_0', attr('VEC2', uv))
  .setAttribute('_SOURCE_FACE_RGB', attr('VEC3', colors).setNormalized(true));
doc
  .createScene()
  .addChild(
    doc
      .createNode('masteryi-q-contact-trail')
      .setMesh(doc.createMesh('masteryi-q-contact-trail').addPrimitive(primitive))
  )
  .setExtras({
    source: source.source,
    unitScale: 0.01,
    sourceVersion: mesh.version,
    sourceFlags: mesh.flags,
    sourceName: mesh.sourceName,
    sourceVertices: mesh.sourceVertices,
    centralPoint: mesh.centralPoint,
    rawSourceBounds: mesh.sourceBounds,
    measuredMinMax: mesh.measuredMinMax,
    materialSlots: mesh.materialSlots,
    faceMaterialIndices: mesh.faceMaterialIndices,
    unusedSourceVertices: mesh.unusedSourceVertices,
    tailHex: mesh.tailHex,
    note: 'Expanded source triangle corners retain order, UVs and opaque face RGB. Native hasVertexColors=0; RGB is a custom audit attribute, not an invented material tint. No normals, pivot offset, reflection or winding change.',
  });
doc.getRoot().getAsset().copyright = 'Master Yi artwork © Riot Games. Reference content.';
const io = new NodeIO(),
  bytes = await io.writeBinary(doc),
  report = await validator.validateBytes(bytes);
assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
for (const key of ['POSITION', 'TEXCOORD_0', '_SOURCE_FACE_RGB'])
  assert.deepEqual(restored.getAttribute(key).getArray(), primitive.getAttribute(key).getArray());
assert.equal(restored.getIndices(), null);
const output = '.cache/masteryi-q-contact-packed-v2/masteryi-q-contact-trail.glb';
const audit = {
  source: source.source,
  decoded: { path: source.path, sha256: source.sha256 },
  output: { path: output, bytes: bytes.length, sha256: hash(bytes) },
  sourceVertices: mesh.sourceVertices,
  triangles: mesh.triangles,
  exportedCorners: positions.length / 3,
  attributes: {
    positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
    uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
    faceRgbSha256: hash(colors),
  },
  centralPoint: mesh.centralPoint,
  rawSourceBounds: mesh.sourceBounds,
  measuredMinMax: mesh.measuredMinMax,
  tailHex: mesh.tailHex,
  flags: mesh.flags,
  sourceHasVertexColors: false,
  sourceFaceRgbAppliedAsMaterial: false,
  normalsGenerated: false,
  validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
};
const outputs = [
  [output, bytes],
  [output + '.json', Buffer.from(JSON.stringify(audit, null, 2) + '\n')],
];
for (const [path, data] of outputs) {
  let old;
  try {
    old = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (old) assert.ok(old.equals(Buffer.from(data)), `Conflicting output: ${path}`);
}
await mkdir('.cache/masteryi-q-contact-packed-v2', { recursive: true });
for (const [path, data] of outputs) {
  try {
    await writeFile(path, data, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.ok((await readFile(path)).equals(Buffer.from(data)), `Conflicting output: ${path}`);
  }
}
console.log(JSON.stringify(audit, null, 2));
