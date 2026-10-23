import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
execFileSync('python3', ['tools/assets/decode-lux-e-slash.py'], { stdio: 'inherit' });
const m = JSON.parse(await readFile('.cache/lux-e-slash-decoded.json'));
const doc = new Document(),
  buffer = doc.createBuffer();
const positions = Float32Array.from(m.positions, (v) => v * 0.01),
  uv = new Float32Array(m.uv);
const attr = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const primitive = doc
  .createPrimitive()
  .setAttribute('POSITION', attr('VEC3', positions))
  .setAttribute('TEXCOORD_0', attr('VEC2', uv));
doc
  .createScene()
  .addChild(
    doc
      .createNode('Lux E spinner slash')
      .setMesh(doc.createMesh('Lux E spinner slash').addPrimitive(primitive))
  );
doc.getRoot().getAsset().copyright = 'Lux artwork © Riot Games. Reference content.';
const io = new NodeIO(),
  bytes = await io.writeBinary(doc);
const checked = await validator.validateBytes(bytes);
assert.equal(checked.issues.numErrors, 0);
assert.equal(checked.issues.numWarnings, 0);
const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
assert.deepEqual(restored.getAttribute('POSITION').getArray(), positions);
assert.deepEqual(restored.getAttribute('TEXCOORD_0').getArray(), uv);
const path = 'public/assets/models/lux-e-slash.glb';
await writeFile(path, bytes);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const audit = {
  source: m.source,
  output: { path: path.replace('public/', ''), bytes: bytes.length, sha256: hash(bytes) },
  unitScale: 0.01,
  vertices: m.vertices,
  triangles: m.triangles,
  flags: m.flags,
  pivot: m.pivot,
  headerBounds: m.headerBounds,
  materials: m.materials,
  positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
  uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
  validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
  note: 'Source winding, coordinates and face-corner UVs retained; no emitter transform, radius fit, axis reflection or pivot offset baked in.',
};
await writeFile('public/assets/models/lux-e-slash.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit.output));
