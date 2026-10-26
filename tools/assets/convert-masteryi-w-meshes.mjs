/** Stage both native Meditate meshes. No public assets or runtime binding. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

execFileSync('python', ['tools/assets/decode-masteryi-w-particles.py', '--check'], {
  stdio: 'inherit',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordBytes = await readFile('docs/reference/masteryi/w-particles-decoded.json');
assert.equal(hash(recordBytes), '883a15ed890b9e00aff316de67e58f5e99a123ff0f72337b98b7fc06e2866503');
const sources = JSON.parse(recordBytes).meshes;
assert.equal(sources.length, 2);
const profiles = new Map([
  [
    '57109d0973203910',
    { name: 'masteryi-w-torus', vertices: 180, triangles: 320, flags: 1, tailBytes: 0 },
  ],
  [
    '9eb4899793c343eb',
    { name: 'masteryi-w-heal', vertices: 403, triangles: 733, flags: 5, tailBytes: 24 },
  ],
]);
const outputs = [],
  audits = [];
for (const source of sources) {
  const profile = profiles.get(source.source.wadPathHash);
  assert.ok(profile, 'Unexpected Meditate mesh');
  const raw = await readFile(source.path);
  assert.equal(raw.length, source.bytes);
  assert.equal(hash(raw), source.sha256);
  const mesh = JSON.parse(raw);
  assert.equal(mesh.triangles, profile.triangles);
  assert.equal(mesh.sourceVertices, profile.vertices);
  assert.equal(mesh.flags, profile.flags);
  assert.equal(mesh.tailHex.length, profile.tailBytes * 2);
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
  const attr = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', attr('VEC3', positions))
    .setAttribute('TEXCOORD_0', attr('VEC2', uv))
    .setAttribute('_SOURCE_FACE_RGB', attr('VEC3', colors).setNormalized(true));
  doc
    .createScene()
    .addChild(
      doc.createNode(profile.name).setMesh(doc.createMesh(profile.name).addPrimitive(primitive))
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
  const output = `.cache/masteryi-w-packed-meshes/${profile.name}.glb`;
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
  outputs.push(
    [output, bytes],
    [output + '.json', Buffer.from(JSON.stringify(audit, null, 2) + '\n')]
  );
  audits.push(audit);
}
for (const [path, data] of outputs) {
  let old;
  try {
    old = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (old) assert.ok(old.equals(Buffer.from(data)), `Conflicting output: ${path}`);
}
await mkdir('.cache/masteryi-w-packed-meshes', { recursive: true });
for (const [path, data] of outputs) {
  try {
    await writeFile(path, data, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.ok((await readFile(path)).equals(Buffer.from(data)), `Conflicting output: ${path}`);
  }
}
console.log(JSON.stringify(audits, null, 2));
