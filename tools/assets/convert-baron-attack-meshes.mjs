/** Stage native Baron attack meshes privately; retain packed vertex BGRA as an audit attribute. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } });
const root = values['output-dir'] ?? '.cache/baron-attack-packed';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordPath = 'docs/reference/baron-attack-decoded.json';
const recordBytes = await readFile(recordPath);
assert.equal(hash(recordBytes), 'ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20');
const record = JSON.parse(recordBytes);
assert.equal(record.meshes.length, 2);
// Preflight both decoded inputs before generating or writing any output.
const inputs = await Promise.all(
  record.meshes.map(async (source) => {
    const path = '.cache/baron-attack-decoded/' + source.path;
    const raw = await readFile(path);
    assert.equal(raw.length, source.bytes);
    assert.equal(hash(raw), source.sha256);
    return { source, mesh: JSON.parse(raw) };
  })
);
const io = new NodeIO(),
  outputs = [],
  audits = [];
for (const { source, mesh } of inputs) {
  assert.deepEqual(mesh.version, [3, 2]);
  assert.equal(mesh.flags, 2);
  assert.equal(mesh.sourceIndices.length, mesh.triangles * 3);
  const bgra = Buffer.from(mesh.sourceVertexBgraHex, 'hex');
  assert.equal(bgra.length, mesh.sourceVertices * 4);
  const positions = new Float32Array(mesh.sourceIndices.length * 3);
  const uv = new Float32Array(mesh.sourceIndices.length * 2);
  const colors = new Uint8Array(mesh.sourceIndices.length * 4);
  mesh.sourceIndices.forEach((index, corner) => {
    assert(Number.isInteger(index) && index >= 0 && index < mesh.sourceVertices);
    mesh.sourcePoints[index].forEach((value, axis) => {
      assert(Number.isFinite(value));
      positions[corner * 3 + axis] = value * 0.01;
    });
    const face = Math.floor(corner / 3),
      local = corner % 3;
    uv[corner * 2] = mesh.faceUv[face][local];
    uv[corner * 2 + 1] = mesh.faceUv[face][local + 3];
    colors.set(bgra.subarray(index * 4, index * 4 + 4), corner * 4);
  });
  assert([...uv].every(Number.isFinite));
  const doc = new Document(),
    buffer = doc.createBuffer();
  const attr = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', attr('VEC3', positions))
    .setAttribute('TEXCOORD_0', attr('VEC2', uv))
    .setAttribute('_SOURCE_VERTEX_BGRA', attr('VEC4', colors).setNormalized(true));
  doc
    .createScene()
    .addChild(
      doc
        .createNode(source.source.wadPathHash)
        .setMesh(doc.createMesh(source.source.wadPathHash).addPrimitive(primitive))
    )
    .setExtras({
      source: source.source,
      unitScale: 0.01,
      sourceName: mesh.sourceName,
      sourceFlags: mesh.flags,
      materialSlots: mesh.materialSlots,
      faceMaterialIndices: mesh.faceMaterialIndices,
      note: 'Triangle corners expanded in source order; raw BGRA remains unswizzled. No material, normals, pivot offset, reflection, winding change or UV flip. Private staging only.',
    });
  doc.getRoot().getAsset().copyright = 'Baron artwork © Riot Games. Reference content.';
  const bytes = await io.writeBinary(doc),
    validation = await validator.validateBytes(bytes);
  assert.equal(validation.issues.numErrors, 0, JSON.stringify(validation.issues));
  assert.equal(validation.issues.numWarnings, 0, JSON.stringify(validation.issues));
  const restored = await io.readBinary(bytes);
  const result = restored.getRoot().listMeshes()[0].listPrimitives()[0];
  for (const key of ['POSITION', 'TEXCOORD_0', '_SOURCE_VERTEX_BGRA']) {
    assert.deepEqual(result.getAttribute(key).getArray(), primitive.getAttribute(key).getArray());
    assert.equal(
      result.getAttribute(key).getNormalized(),
      primitive.getAttribute(key).getNormalized()
    );
  }
  assert.equal(result.getIndices(), null);
  const loaded = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ''
  );
  const loadedMeshes = [];
  loaded.scene.updateMatrixWorld(true);
  loaded.scene.traverse((node) => {
    if (node instanceof THREE.Mesh) loadedMeshes.push(node);
  });
  assert.equal(loadedMeshes.length, 1);
  const loadedMesh = loadedMeshes[0];
  assert(loadedMesh.matrixWorld.equals(new THREE.Matrix4()));
  for (const [key, expected] of [
    ['position', positions],
    ['uv', uv],
    ['_source_vertex_bgra', colors],
  ]) {
    const attribute = loadedMesh.geometry.getAttribute(key);
    assert.equal(attribute.count * attribute.itemSize, expected.length);
    // GLTFLoader interleaves these accessors. Read their own raw components,
    // excluding neighboring UV/color bytes and without normalized conversion.
    const actual = new expected.constructor(expected.length);
    for (let vertex = 0; vertex < attribute.count; vertex++)
      for (let component = 0; component < attribute.itemSize; component++)
        actual[vertex * attribute.itemSize + component] = attribute.isInterleavedBufferAttribute
          ? attribute.data.array[vertex * attribute.data.stride + attribute.offset + component]
          : attribute.array[vertex * attribute.itemSize + component];
    assert.deepEqual(actual, expected);
  }
  assert.equal(loadedMesh.geometry.getAttribute('_source_vertex_bgra').normalized, true);
  loadedMesh.geometry.dispose();
  loadedMesh.material.dispose();
  assert.deepEqual(
    restored.getRoot().listScenes()[0].getExtras(),
    doc.getRoot().listScenes()[0].getExtras()
  );
  const name = source.source.wadPathHash + '.glb';
  outputs.push([name, bytes]);
  audits.push({
    source: source.source,
    decodedSha256: source.sha256,
    name,
    bytes: bytes.length,
    sha256: hash(bytes),
    sourceVertices: mesh.sourceVertices,
    triangles: mesh.triangles,
    corners: positions.length / 3,
    positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
    uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
    vertexBgraSha256: hash(colors),
    validation: { errors: 0, warnings: 0, exactAttributeRoundTrip: true, threeLoaderExact: true },
  });
}
const audit = {
  decodedRecordSha256: hash(recordBytes),
  unitScale: 0.01,
  meshes: audits,
  runtimeChanged: false,
  limits:
    'Private mesh staging only; no material dispatch, attachment, native renderer or visual parity claim.',
};
outputs.push(['meshes.json', Buffer.from(JSON.stringify(audit, null, 2) + '\n')]);
for (const [name, bytes] of outputs) {
  try {
    assert((await readFile(root + '/' + name)).equals(bytes), 'Conflicting output: ' + name);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await mkdir(root, { recursive: true });
for (const [name, bytes] of outputs) {
  try {
    await writeFile(root + '/' + name, bytes, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert((await readFile(root + '/' + name)).equals(bytes), 'Conflicting output: ' + name);
  }
}
console.log(JSON.stringify(audit));
