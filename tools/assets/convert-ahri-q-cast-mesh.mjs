/** Prepare the source swirls as a verified GLB transport; no runtime dispatch. */
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import validator from 'gltf-validator';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const output = '.cache/ahri-q-cast-mesh-v1';
const rawRecord = await readFile('docs/reference/ahri/q-particles-decoded.json');
assert.equal(sha(rawRecord), '7b040643c0361810c60e3d467af5c27e47f4d1ca3024b023582f132539628bc9');
const record = JSON.parse(rawRecord);
const row = record.meshes.find((m) => m.source.path.endsWith('/ahri_base_q_swirls_01.scb'));
assert(row);
const rawMesh = await readFile(row.path);
assert.equal(sha(rawMesh), row.sha256);
const native = JSON.parse(rawMesh);
assert.equal(native.flags, 2);
assert.equal(native.sourceVertices, 603);
assert.equal(native.triangles, 792);
assert.equal(native.materialSlots.length, 1);
assert.equal(native.hasVertexColors, true);
const colors = Buffer.from(native.vertexRgbaHex, 'hex');
const positions = [],
  uvs = [],
  rgba = [],
  indices = [],
  sourceVertices = [],
  slots = new Map();
for (let face = 0; face < native.triangles; face++)
  for (let corner = 0; corner < 3; corner++) {
    const source = native.sourceIndices[face * 3 + corner],
      uv = [native.faceUv[face][corner], native.faceUv[face][corner + 3]];
    const uvBits = Buffer.from(Float32Array.from(uv).buffer).toString('hex'),
      key = source + ':' + uvBits;
    let slot = slots.get(key);
    if (slot === undefined) {
      slot = sourceVertices.length;
      slots.set(key, slot);
      sourceVertices.push(source);
      positions.push(...native.sourcePoints[source]);
      uvs.push(...uv);
      rgba.push(...colors.subarray(source * 4, source * 4 + 4));
    }
    indices.push(slot);
  }
assert(sourceVertices.length <= 65535);
const doc = new Document(),
  buffer = doc.createBuffer('Ahri Q cast swirls');
const accessor = (name, type, array, normalized = false) =>
  doc
    .createAccessor(name)
    .setType(type)
    .setArray(array)
    .setNormalized(normalized)
    .setBuffer(buffer);
const primitive = doc
  .createPrimitive()
  .setAttribute('POSITION', accessor('Source positions', 'VEC3', Float32Array.from(positions)))
  .setAttribute('TEXCOORD_0', accessor('Source UVs', 'VEC2', Float32Array.from(uvs)))
  .setAttribute('COLOR_0', accessor('Source vertex RGBA', 'VEC4', Uint8Array.from(rgba), true))
  .setIndices(accessor('Triangle indices', 'SCALAR', Uint16Array.from(indices)));
const unlit = doc.createExtension(KHRMaterialsUnlit).setRequired(true);
primitive.setMaterial(
  doc
    .createMaterial('Unbound source mesh')
    .setDoubleSided(true)
    .setAlphaMode('BLEND')
    .setExtension('KHR_materials_unlit', unlit.createUnlit())
);
const mesh = doc.createMesh('Ahri_Q_Cas_Temp_Mesh').addPrimitive(primitive);
const node = doc.createNode('Ahri_Q_Cas_Temp_Mesh').setMesh(mesh).setExtras({
  sourcePath: row.source.path,
  sourceSha256: row.source.sha256,
  sourceVertexIndices: sourceVertices,
  coordinateTransformApplied: false,
  nativeShaderBound: false,
});
doc.createScene('Ahri Q source swirls').addChild(node);
await doc.transform(dedup(), prune({ keepAttributes: true }));
const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]),
  glb = await io.writeBinary(doc),
  replay = await io.readBinary(glb);
const loaded = replay.getRoot().listMeshes()[0].listPrimitives()[0];
const p = loaded.getAttribute('POSITION').getArray(),
  uv = loaded.getAttribute('TEXCOORD_0').getArray(),
  c = loaded.getAttribute('COLOR_0').getArray(),
  ix = loaded.getIndices().getArray();
assert.equal(loaded.getAttribute('NORMAL'), null);
assert.equal(ix.length, native.triangles * 3);
assert.equal(loaded.getAttribute('COLOR_0').getNormalized(), true);
const map = replay
  .getRoot()
  .listNodes()
  .find((n) => n.getName() === 'Ahri_Q_Cas_Temp_Mesh')
  .getExtras().sourceVertexIndices;
for (let i = 0; i < ix.length; i++) {
  const slot = ix[i],
    source = native.sourceIndices[i],
    face = Math.floor(i / 3),
    corner = i % 3;
  assert.equal(map[slot], source);
  for (let axis = 0; axis < 3; axis++)
    assert(Object.is(p[slot * 3 + axis], native.sourcePoints[source][axis]));
  assert(Object.is(uv[slot * 2], native.faceUv[face][corner]));
  assert(Object.is(uv[slot * 2 + 1], native.faceUv[face][corner + 3]));
  for (let channel = 0; channel < 4; channel++)
    assert.equal(c[slot * 4 + channel], colors[source * 4 + channel]);
}
const validation = await validator.validateBytes(glb, { uri: 'ahri-q-cast-swirls.glb' });
assert.equal(validation.issues.numErrors, 0);
assert.equal(validation.issues.numWarnings, 0);
const metadata = {
  validation: { errors: validation.issues.numErrors, warnings: validation.issues.numWarnings },
  format: 1,
  source: row.source,
  decodedRecordSha256: sha(rawRecord),
  sourceVertices: native.sourceVertices,
  sourceTriangles: native.triangles,
  transportVertices: sourceVertices.length,
  triangleReplayExact: true,
  uvReplayExact: true,
  vertexColorReplayExact: true,
  normalAttributeGenerated: false,
  sourceCoordinateTransformApplied: false,
  optimization: ['dedup', 'prune with keepAttributes'],
  glb: { path: output + '/ahri-q-cast-swirls.glb', bytes: glb.byteLength, sha256: sha(glb) },
  limits: [
    'GLB transport preserves rendered source triangles; complete original points/indices/UV/material bytes remain in the private native mesh record.',
    'Source UVs and coordinates remain unchanged. Native orientation, pivots, material arithmetic and runtime attachment are unbound.',
    'The unlit white material is a transport placeholder, not a source particle shader.',
  ],
};
const outputs = [
  [metadata.glb.path, glb],
  [output + '/mesh.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n')],
];
for (const [path, bytes] of outputs) {
  let current = resolve(path);
  while (true) {
    try {
      assert(!(await lstat(current)).isSymbolicLink(), 'Output path cannot contain symlinks');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  try {
    assert.deepEqual(await readFile(path), Buffer.from(bytes), 'Conflicting mesh output');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
for (const [path, bytes] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}
process.stdout.write(JSON.stringify(metadata) + '\n');
