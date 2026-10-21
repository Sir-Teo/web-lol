/** Package source R geometry and audit dependencies; runtime attachment is separate. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-garen-r-particles.py'], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: '.tools/cdtb' },
});
const data = JSON.parse(await readFile('.cache/garen-r-particles-decoded.json'));
const pin = JSON.parse(await readFile('docs/reference/garen-r-particles.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const names = {
  garen_base_r_halfdome: 'garen-r-halfdome',
  garen_base_r_praxis: 'garen-r-praxis',
  garen_base_r_sword_plane: 'garen-r-sword-plane',
  garen_ha_ap_sphere_geo: 'garen-r-sphere',
};
const io = new NodeIO(),
  outputs = [];
for (const mesh of data.meshes) {
  const name = names[mesh.source.path.split('/').at(-1).replace('.scb', '')];
  assert.ok(name, 'Unexpected source mesh');
  const doc = new Document(),
    buffer = doc.createBuffer();
  const attr = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const positions = Float32Array.from(mesh.positions, (v) => v * 0.01);
  const uv = new Float32Array(mesh.uv),
    colors = new Uint8Array(mesh.sourceFaceRGB);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', attr('VEC3', positions))
    .setAttribute('TEXCOORD_0', attr('VEC2', uv))
    .setAttribute('_SOURCE_FACE_RGB', attr('VEC3', colors).setNormalized(true));
  doc
    .createScene()
    .addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)))
    .setExtras({
      unitScale: 0.01,
      source: mesh.source,
      sourceName: mesh.sourceName,
      centralPoint: mesh.centralPoint,
      rawSourceBounds: mesh.sourceBounds,
      measuredMinMax: mesh.measuredMinMax,
      sourceFlags: mesh.flags,
      sourceMaterials: mesh.materials,
      tailHex: mesh.tailHex,
      note: 'Source coordinates retained. Header bounds are zero. No pivot offset, axis reflection, winding change, emitter transform or particle material applied. Face RGB, pivot and tail retain no guessed runtime meaning.',
    });
  doc.getRoot().getAsset().copyright = 'Garen artwork © Riot Games. Reference content.';
  const bytes = await io.writeBinary(doc);
  const report = await validator.validateBytes(bytes);
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
  for (const key of ['POSITION', 'TEXCOORD_0', '_SOURCE_FACE_RGB'])
    assert.deepEqual(restored.getAttribute(key).getArray(), primitive.getAttribute(key).getArray());
  assert.equal(restored.getIndices(), null);
  const path = `public/assets/models/${name}.glb`;
  await writeFile(path, bytes);
  const manifest = {
    output: { path: path.replace('public', ''), bytes: bytes.length, sha256: hash(bytes) },
    source: mesh.source,
    sourceVertices: mesh.sourceVertices,
    triangles: mesh.triangles,
    exportedCorners: positions.length / 3,
    centralPoint: mesh.centralPoint,
    rawSourceBounds: mesh.sourceBounds,
    measuredMinMax: mesh.measuredMinMax,
    tailHex: mesh.tailHex,
    positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
    uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
    faceRgbSha256: hash(colors),
    materials: mesh.materials,
    validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
  };
  await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
  outputs.push(manifest);
}
function unresolved(value, result = new Set()) {
  if (typeof value === 'string' && /^\{[a-f0-9]{8,16}\}$/.test(value)) result.add(value);
  else if (Array.isArray(value)) value.forEach((v) => unresolved(v, result));
  else if (value && typeof value === 'object')
    for (const [key, v] of Object.entries(value)) {
      unresolved(key, result);
      unresolved(v, result);
    }
  return [...result].sort();
}
const model = JSON.parse(await readFile('docs/reference/garen-model.json'));
const animation =
  model.animations.data['Characters/Garen/Animations/Skin0'].mClipDataMap.Spell4_Base;
const audit = {
  sourcePinSha256: data.sourcePinSha256,
  modelPinSha256: hash(await readFile('docs/reference/garen-model.json')),
  unitScale: 0.01,
  textures: data.textures,
  meshes: outputs,
  systems: Object.fromEntries(
    Object.entries(pin.resources).map(([key, r]) => [
      key,
      {
        record: r.record,
        emitterCount: r.definition.complexEmitterDefinitionData.length,
        emitters: r.definition.complexEmitterDefinitionData.map((e, index) => ({
          index,
          name: e.emitterName,
          primitive: e.primitive?.__type ?? null,
          explicitFields: Object.keys(e).sort(),
        })),
        unresolvedIdentifiers: unresolved(r.definition),
      },
    ])
  ),
  animationParticleEvents: animation.mEventDataMap,
  status:
    'Source packaging only. No runtime dispatch, particle defaults, material semantics, native timing or rendered parity are established by this conversion.',
};
await writeFile(
  'docs/reference/garen-r-particles-decoded.json',
  JSON.stringify(audit, null, 2) + '\n'
);
console.log(
  JSON.stringify(
    outputs.map((o) => ({ path: o.output.path, bytes: o.output.bytes, triangles: o.triangles }))
  )
);
