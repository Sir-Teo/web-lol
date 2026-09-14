/** Lossless source triangle/UV packaging; emitter transforms and shaders are separate. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-lux-binding-target-meshes.py'], {
  stdio: 'inherit',
});
const data = JSON.parse(await readFile('.cache/lux-binding-target-meshes.json'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const io = new NodeIO(),
  outputs = [];
for (const mesh of data.meshes) {
  const name = mesh.source.path.split('/').at(-1).replace('.scb', '');
  const doc = new Document(),
    buffer = doc.createBuffer();
  const accessor = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const positions = Float32Array.from(mesh.positions, (value) => value * 0.01);
  const uv = new Float32Array(mesh.uv);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', positions))
    .setAttribute('TEXCOORD_0', accessor('VEC2', uv));
  // Expanded face corners preserve every UV seam and source triangle order.
  doc
    .createScene()
    .addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)))
    .setExtras({
      unitScale: 0.01,
      source: mesh.source,
      sourceName: mesh.sourceName,
      centralPoint: mesh.centralPoint,
      rawSourceBounds: mesh.sourceBounds,
      sourceFlags: mesh.flags,
      sourceMaterials: mesh.materials,
      note: 'Source coordinates retained at 0.01 scale. No center offset, axis reflection, winding change, emitter transform or particle material applied.',
    });
  doc.getRoot().getAsset().copyright = 'Lux artwork © Riot Games. Reference content.';
  const bytes = await io.writeBinary(doc);
  const report = await validator.validateBytes(bytes);
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const restored = await io.readBinary(bytes);
  const decoded = restored.getRoot().listMeshes()[0].listPrimitives()[0];
  assert.deepEqual(decoded.getAttribute('POSITION').getArray(), positions);
  assert.deepEqual(decoded.getAttribute('TEXCOORD_0').getArray(), uv);
  assert.equal(decoded.getIndices(), null);
  const path = `public/assets/models/lux-binding-target-${name}.glb`;
  await writeFile(path, bytes);
  outputs.push({
    source: mesh.source,
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
    triangles: mesh.triangles,
    sourceVertices: mesh.sourceVertices,
    exportedCorners: positions.length / 3,
    positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
    uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
    centralPoint: mesh.centralPoint,
    rawSourceBounds: mesh.sourceBounds,
    measuredMinMax: mesh.measuredMinMax,
    materials: mesh.materials,
    validation: report.issues,
  });
}
await writeFile(
  'docs/reference/lux-binding-target-meshes.json',
  JSON.stringify(
    {
      sourcePinSha256: data.sourcePinSha256,
      layoutReference: data.layoutReference,
      unitScale: 0.01,
      outputs,
      status:
        'Source mesh packaging only; no particle materials, emitter transforms or native rendered comparison.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify(outputs.map((m) => ({ path: m.path, bytes: m.bytes, triangles: m.triangles })))
);
