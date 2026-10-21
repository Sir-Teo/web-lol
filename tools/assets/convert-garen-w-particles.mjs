/** Package all frozen Courage geometry and audit dependencies; runtime attachment is separate. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-garen-w-particles.py'], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: '.tools/cdtb' },
});
const data = JSON.parse(await readFile('.cache/garen-w-particles-decoded.json'));
const pin = JSON.parse(await readFile('docs/reference/garen-w-particles.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const names = {
  garen_base_w_shield: 'garen-w-shield',
  arrow01: 'garen-w-attached-placeholder',
};
const groups = new Map();
for (const mesh of data.meshes) {
  const group = groups.get(mesh.source.sha256) ?? [];
  group.push(mesh);
  groups.set(mesh.source.sha256, group);
}
const io = new NodeIO(),
  outputs = [];
for (const group of groups.values()) {
  const mesh = group[0];
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
      sourceAliases: group.map((m) => m.source),
      sourceVersion: mesh.version,
      sourceName: mesh.sourceName,
      centralPoint: mesh.centralPoint,
      rawSourceBounds: mesh.sourceBounds,
      measuredMinMax: mesh.measuredMinMax,
      sourceFlags: mesh.flags,
      sourceMaterials: mesh.materials,
      tailHex: mesh.tailHex,
      note: 'Source positions/UVs/face RGB retained. No pivot offset, reflection, winding change, emitter transform or material override applied. The shared arrow is an attached-mesh reference, not a reconstructed character overlay.',
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
    sourceAliases: group.map((m) => m.source),
    sourceVersion: mesh.version,
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

const audit = {
  sourcePinSha256: data.sourcePinSha256,
  modelPinSha256: hash(await readFile('docs/reference/garen-model.json')),
  unitScale: 0.01,
  layoutReference: data.layoutReference,
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
  avatarMaterialOverrides: Object.fromEntries(
    Object.entries(pin.resources)
      .filter(([key]) => key.includes('Avatar'))
      .map(([key, r]) => [
        key,
        r.definition.complexEmitterDefinitionData.flatMap(
          (e, index) =>
            e.materialOverrideDefinitions?.map((definition) => ({ index, definition })) ?? []
        ),
      ])
  ),
  animationParticleEvents: Object.fromEntries(
    Object.entries(model.animations.data['Characters/Garen/Animations/Skin0'].mClipDataMap).flatMap(
      ([key, clip]) =>
        Object.entries(clip.mEventDataMap ?? {})
          .filter(([, event]) => event.mEffectKey?.startsWith('Garen_W_'))
          .map(([eventKey, event]) => [key + ':' + eventKey, event])
    )
  ),
  status:
    'Source packaging only. No runtime dispatch, particle defaults, material semantics, native timing or rendered parity are established by this conversion.',
};
await writeFile(
  'docs/reference/garen-w-particles-decoded.json',
  JSON.stringify(audit, null, 2) + '\n'
);
console.log(
  JSON.stringify(
    outputs.map((o) => ({ path: o.output.path, bytes: o.output.bytes, triangles: o.triangles }))
  )
);
