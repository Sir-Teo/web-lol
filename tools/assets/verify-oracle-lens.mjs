/** Independently compare packaged geometry with the original binary buffers. */
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const pinBytes = await readFile('docs/reference/oracle-lens-source.json');
const pin = JSON.parse(pinBytes),
  ledgerBytes = await readFile('docs/reference/oracle-lens-assets.json');
const ledger = JSON.parse(ledgerBytes),
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
assert.equal(ledger.sourcePinSha256, hash(pinBytes));
const originals = new Map();
for (const source of pin.extraction.files) {
  const bytes = await readFile('.cache/oracle-lens/original/' + source.path);
  assert.equal(bytes.length, source.bytes);
  assert.equal(hash(bytes), source.sha256);
  originals.set(source.path, bytes);
}
const staticMeshes = [];
for (const m of ledger.meshes) {
  const raw = originals.get(m.source.path),
    bytes = await readFile('public' + m.output.path);
  assert.equal(hash(bytes), m.output.sha256);
  const primitive = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
  assert.equal(raw.subarray(0, 8).toString(), 'r3d2Mesh');
  assert.deepEqual([raw.readUInt16LE(8), raw.readUInt16LE(10)], [3, 2]);
  const vertices = raw.readUInt32LE(140),
    faces = raw.readUInt32LE(144),
    flags = raw.readUInt32LE(148);
  assert.equal(raw.readUInt32LE(176), 0);
  const faceStart = 180 + vertices * 12 + 12;
  const positions = [],
    uv = [];
  for (let f = 0; f < faces; f++)
    for (let corner = 0; corner < 3; corner++) {
      const at = faceStart + f * 100,
        vertex = raw.readUInt32LE(at + corner * 4);
      assert.ok(vertex < vertices);
      for (let axis = 0; axis < 3; axis++)
        positions.push(Math.fround(raw.readFloatLE(180 + vertex * 12 + axis * 4) * 0.01));
      uv.push(raw.readFloatLE(at + 76 + corner * 4), raw.readFloatLE(at + 88 + corner * 4));
    }
  assert.deepEqual(Array.from(primitive.getAttribute('POSITION').getArray()), positions);
  assert.deepEqual(Array.from(primitive.getAttribute('TEXCOORD_0').getArray()), uv);
  assert.equal(primitive.getIndices(), null);
  const colorAt = faceStart + faces * 100,
    hasColors = !!(flags & 1);
  if (hasColors)
    assert.deepEqual(
      Array.from(primitive.getAttribute('_SOURCE_FACE_RGB').getArray()),
      Array.from(raw.subarray(colorAt, colorAt + faces * 9))
    );
  else assert.equal(primitive.getAttribute('_SOURCE_FACE_RGB'), null);
  assert.equal(raw.subarray(colorAt + (hasColors ? faces * 9 : 0)).toString('hex'), m.tailHex);
  staticMeshes.push({
    path: m.output.path,
    sourceSha256: m.source.sha256,
    outputSha256: m.output.sha256,
    triangles: faces,
    flags,
    faceColorsPresent: hasColors,
    exactFaceCorners: true,
    exactUVs: true,
    exactOptionalFaceRGB: true,
    opaqueTailRetained: true,
  });
}
const skinSource = pin.extraction.files.find((f) => f.path.endsWith('.skn'));
const skin = originals.get(skinSource.path),
  rigBytes = await readFile('public' + ledger.rig.output.path);
assert.equal(hash(rigBytes), ledger.rig.output.sha256);
assert.deepEqual(
  [skin.readUInt32LE(0), skin.readUInt16LE(4), skin.readUInt16LE(6)],
  [0x00112233, 2, 1]
);
assert.equal(skin.readUInt32LE(8), 1); // one authored material/submesh
const header = 12 + 80,
  indexCount = skin.readUInt32LE(header),
  vertexCount = skin.readUInt32LE(header + 4);
const vertexStart = header + 8 + indexCount * 2;
assert.equal(vertexStart + vertexCount * 52 + 12, skin.length);
const doc = await io.readBinary(rigBytes),
  primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
assert.equal(primitive.getAttribute('POSITION').getCount(), vertexCount);
assert.deepEqual(
  Array.from(primitive.getIndices().getArray()),
  Array.from({ length: indexCount }, (_, i) => skin.readUInt16LE(header + 8 + i * 2))
);
for (let i = 0; i < vertexCount; i++) {
  const at = vertexStart + i * 52;
  for (let axis = 0; axis < 3; axis++)
    assert.equal(
      primitive.getAttribute('POSITION').getArray()[i * 3 + axis],
      Math.fround(skin.readFloatLE(at + axis * 4) * 0.01)
    );
  for (let axis = 0; axis < 2; axis++)
    assert.equal(
      primitive.getAttribute('TEXCOORD_0').getArray()[i * 2 + axis],
      skin.readFloatLE(at + 44 + axis * 4)
    );
  for (let j = 0; j < 4; j++) {
    const weight = skin.readFloatLE(at + 16 + j * 4);
    assert.equal(primitive.getAttribute('WEIGHTS_0').getArray()[i * 4 + j], weight);
    assert.equal(
      primitive.getAttribute('JOINTS_0').getArray()[i * 4 + j],
      weight === 0 ? 0 : skin[at + 12 + j]
    );
  }
}
for (const t of ledger.textures) {
  const bytes = await readFile(t.path);
  assert.equal(bytes.length, t.bytes);
  assert.equal(hash(bytes), t.sha256);
}
const report = {
  sourcePinSha256: hash(pinBytes),
  assetsSha256: hash(ledgerBytes),
  scope:
    'Original hashed source buffers versus packaged geometry. This does not certify native animation evaluation, particle playback, gameplay or visual parity.',
  staticMeshes,
  skinnedMesh: {
    sourceSha256: skinSource.sha256,
    outputSha256: ledger.rig.output.sha256,
    vertices: vertexCount,
    triangles: indexCount / 3,
    exactIndices: true,
    exactScaledPositions: true,
    exactUVs: true,
    exactWeights: true,
    exactWeightedJoints: true,
    zeroWeightSlotsCanonical: true,
    bones: doc
      .getRoot()
      .listSkins()[0]
      .listJoints()
      .map((n) => n.getName()),
    sourceTailHex: skin.subarray(vertexStart + vertexCount * 52).toString('hex'),
    note: 'Original normals remain in the frozen SKN; the inherited unlit converter omits NORMAL from the preview GLB.',
  },
  textures: {
    count: ledger.textures.length,
    pngBytes: ledger.textures.reduce((n, t) => n + t.bytes, 0),
    hashesMatch: true,
    rgbaVerification: 'decode-oracle-lens.py compares decoded RGBA bytes on reproduction.',
  },
};
await writeFile(
  'docs/reference/oracle-lens-geometry-verification.json',
  JSON.stringify(report, null, 2) + '\n'
);
console.log(
  JSON.stringify({
    staticMeshes: staticMeshes.length,
    originalRigVertices: vertexCount,
    originalRigTriangles: indexCount / 3,
    exactSourceBuffers: true,
    textures: ledger.textures.length,
  })
);
