/** Package the complete Solar Flare dependency set; --check changes no output. */
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

const check = process.argv.includes('--check');
const data = JSON.parse(await readFile('.cache/leona-r-particles-decoded-v1-20261024.json'));
const pinBytes = await readFile('docs/reference/leona-r-particles.json');
const pin = JSON.parse(pinBytes);
const hash = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(hash(pinBytes), data.sourcePinSha256);
const names = {
  leona_base_expo_cylinder: 'leona-e-contact-cylinder',
  leona_base_w_releaseaoe_smoke_01: 'leona-w-smoke-01',
  leona_base_r_praxis: 'leona-r-praxis',
  leona_base_r_cas_funnel: 'leona-r-cast-funnel',
};
async function output(path, bytes) {
  let exists = true;
  try {
    await access(path);
  } catch {
    exists = false;
  }
  if (check || exists) assert.deepEqual(await readFile(path), Buffer.from(bytes), path);
  else await writeFile(path, bytes);
}
const io = new NodeIO(),
  outputs = [];
for (const m of data.meshes) {
  const name = names[m.source.path.split('/').at(-1).replace('.scb', '')];
  assert(name, m.source.path);
  const doc = new Document(),
    buffer = doc.createBuffer();
  const attr = (type, values, normalized = false) =>
    doc.createAccessor().setType(type).setArray(values).setNormalized(normalized).setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      attr(
        'VEC3',
        Float32Array.from(m.positions, (v) => v * 0.01)
      )
    )
    .setAttribute('_SOURCE_POSITION', attr('VEC3', new Float32Array(m.positions)))
    .setAttribute('TEXCOORD_0', attr('VEC2', new Float32Array(m.uv)));
  if (m.expandedVertexBGRA.length)
    primitive.setAttribute(
      '_SOURCE_VERTEX_BGRA',
      attr('VEC4', new Uint8Array(m.expandedVertexBGRA), true)
    );
  if (m.sourceFaceRGB.length)
    primitive.setAttribute('_SOURCE_FACE_RGB', attr('VEC3', new Uint8Array(m.sourceFaceRGB), true));
  doc
    .createScene()
    .addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)))
    .setExtras({
      unitScale: 0.01,
      source: m.source,
      sourceName: m.sourceName,
      centralPoint: m.centralPoint,
      sourceBounds: m.sourceBounds,
      measuredMinMax: m.measuredMinMax,
      flags: m.flags,
      sourceMaterials: m.materials,
      tailHex: m.tailHex,
      note: 'Expanded source face corners. POSITION is scaled to metres; _SOURCE_POSITION retains original float32 coordinates. Raw BGRA and face RGB are preserved separately, without assuming their native shader semantics. No pivot, winding, emitter transform or generated normal applied.',
    });
  doc.getRoot().getAsset().copyright = 'Leona artwork © Riot Games. Reference content.';
  const bytes = await io.writeBinary(doc),
    report = await validator.validateBytes(bytes);
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
  for (const semantic of primitive.listSemantics())
    assert.deepEqual(
      restored.getAttribute(semantic).getArray(),
      primitive.getAttribute(semantic).getArray()
    );
  assert.equal(restored.getIndices(), null);
  const path = `public/assets/models/${name}.glb`;
  const hashes = Object.fromEntries(
    primitive.listSemantics().map((semantic) => {
      const a = primitive.getAttribute(semantic).getArray();
      return [semantic, hash(Buffer.from(a.buffer, a.byteOffset, a.byteLength))];
    })
  );
  const manifest = {
    output: { path: path.replace('public', ''), bytes: bytes.length, sha256: hash(bytes) },
    source: m.source,
    sourceVersion: m.version,
    sourceVertices: m.sourceVertices,
    triangles: m.triangles,
    exportedCorners: m.positions.length / 3,
    centralPoint: m.centralPoint,
    rawSourceBounds: m.sourceBounds,
    measuredMinMax: m.measuredMinMax,
    sourceFlags: m.flags,
    sourceVertexColors: m.sourceVertexBGRA.length > 0,
    sourceFaceColors: m.sourceFaceRGB.length > 0,
    materials: m.materials,
    sourceIndicesSha256: hash(Buffer.from(new Uint32Array(m.sourceIndices).buffer)),
    attributeSha256: hashes,
    validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
  };
  await output(path, bytes);
  await output(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
  outputs.push(manifest);
}
assert.equal(outputs.length, 4);
const systems = Object.fromEntries(
  Object.entries(pin.resources).map(([key, r]) => [
    key,
    {
      record: r.record,
      declaration: Object.fromEntries(
        Object.entries(r.definition).filter(([field]) => field !== 'complexEmitterDefinitionData')
      ),
      emitters: r.definition.complexEmitterDefinitionData.map((e, index) => ({
        index,
        name: e.emitterName,
        disabled: e.disabled ?? false,
        primitive: e.primitive?.__type ?? 'billboard',
        definitionSha256: hash(JSON.stringify(e)),
        explicitFields: Object.keys(e).sort(),
        missingBaseTexture: !e.texture,
        playbackImplemented: false,
      })),
    },
  ])
);
const audit = {
  sourcePinSha256: data.sourcePinSha256,
  modelPinSha256: hash(await readFile('docs/reference/leona-model.json')),
  unitScale: 0.01,
  layoutReference: data.layoutReference,
  texDecoder: data.texDecoder,
  textures: data.textures,
  meshes: outputs,
  systems,
  pathResolutions: pin.pathResolutions,
  scope: {
    mode: "standard Summoner's Rift",
    excludedResources: [],
    soundOnlySystems: [],
    visualEmitterRecords: 44,
    totalEmitterRecords: 53,
    enabledEmitterRecords: 44,
    disabledEmitterRecords: 9,
  },
  acceptance: {
    runtimeIntegrated: false,
    nativeDispatchVerified: false,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  },
  status:
    'All six Solar Flare definitions and all authored dependencies retained, including disabled emitters. Planar projections, stencil and noise fields are definitions only; no fallback texture/primitive, generated normals, pivot or winding changes. Native dispatch/defaults/rendering remain unverified.',
};
assert.equal(Object.values(systems).flatMap((s) => s.emitters).length, 53);
assert.equal(
  Object.values(systems)
    .flatMap((s) => s.emitters)
    .filter((e) => !e.disabled).length,
  44
);
await output(
  'docs/reference/leona-r-particles-decoded.json',
  JSON.stringify(audit, null, 2) + '\n'
);
console.log(
  JSON.stringify({
    result: 'passed',
    check,
    systems: 6,
    emitters: 53,
    enabled: 44,
    textures: 41,
    meshes: 4,
    meshBytes: outputs.reduce((n, m) => n + m.output.bytes, 0),
    runtimeIntegrated: false,
    nativeRenderingVerified: false,
  })
);
