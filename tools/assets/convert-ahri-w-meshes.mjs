/** Private complete Fox-Fire mesh transports, with exact per-corner source replay. */
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import validator from 'gltf-validator';
const sha = (raw) => createHash('sha256').update(raw).digest('hex'),
  output = '.cache/ahri-w-meshes-v1';
const rawSource = await readFile('docs/reference/ahri/w-particles.json'),
  rawRecord = await readFile('docs/reference/ahri/w-particles-decoded.json');
assert.equal(sha(rawSource), 'c1226324a728137c05062dafc7d4a102a0799a371d233d58e3f81558c26dbb47');
assert.equal(sha(rawRecord), '11838eed2092e7301577471d3b28670ebc781194f865eb3a1f642fda483abbca');
const source = JSON.parse(rawSource),
  decoded = JSON.parse(rawRecord),
  selected = new Set();
function visit(v) {
  if (typeof v === 'string' && v.toLowerCase().endsWith('.scb')) selected.add(v.toLowerCase());
  else if (v && typeof v === 'object') for (const c of Object.values(v)) visit(c);
}
for (const key of ['Ahri_W_cas', 'Ahri_W_mis', 'Ahri_W_mis_02', 'Ahri_W_tar', 'Ahri_W_weap_cas'])
  visit(source.resources[key].definition);
assert.deepEqual(
  [...selected].sort().map((p) => p.split('/').pop()),
  ['ahri_base_sharp_mesh.scb', 'ahri_base_w_swirls_01.scb']
);
const outputs = [],
  meshes = [];
for (const row of decoded.meshes.filter((m) => selected.has(m.source.path))) {
  const raw = await readFile(row.path);
  assert.equal(sha(raw), row.sha256);
  const native = JSON.parse(raw);
  assert.equal(native.flags, 2);
  assert.equal(native.materialSlots.length, 1);
  const colors = native.hasVertexColors ? Buffer.from(native.vertexRgbaHex, 'hex') : null;
  if (colors) assert.equal(colors.length, native.sourceVertices * 4);
  const positions = [],
    uvs = [],
    rgba = [],
    indices = [],
    sourceVertices = [],
    slots = new Map();
  for (let face = 0; face < native.triangles; face++)
    for (let corner = 0; corner < 3; corner++) {
      const source = native.sourceIndices[face * 3 + corner],
        uv = [native.faceUv[face][corner], native.faceUv[face][corner + 3]],
        key = source + ':' + Buffer.from(Float32Array.from(uv).buffer).toString('hex');
      let slot = slots.get(key);
      if (slot === undefined) {
        slot = sourceVertices.length;
        slots.set(key, slot);
        sourceVertices.push(source);
        positions.push(...native.sourcePoints[source]);
        uvs.push(...uv);
        if (colors) rgba.push(...colors.subarray(source * 4, source * 4 + 4));
      }
      indices.push(slot);
    }
  assert(sourceVertices.length <= 65535);
  const name = row.source.path.split('/').pop().replace('.scb', ''),
    doc = new Document(),
    buffer = doc.createBuffer(name);
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
    .setIndices(accessor('Source triangle indices', 'SCALAR', Uint16Array.from(indices)));
  if (colors)
    primitive.setAttribute('COLOR_0', accessor('Source RGBA', 'VEC4', Uint8Array.from(rgba), true));
  const unlit = doc.createExtension(KHRMaterialsUnlit).setRequired(true);
  primitive.setMaterial(
    doc
      .createMaterial('Unbound source mesh')
      .setDoubleSided(true)
      .setAlphaMode('BLEND')
      .setExtension(KHRMaterialsUnlit, unlit.createUnlit())
  );
  const node = doc
    .createNode(name)
    .setMesh(doc.createMesh(name).addPrimitive(primitive))
    .setExtras({
      sourcePath: row.source.path,
      sourceSha256: row.source.sha256,
      sourceVertexIndices: sourceVertices,
      coordinateTransformApplied: false,
      nativeShaderBound: false,
    });
  doc.createScene(name).addChild(node);
  await doc.transform(dedup(), prune({ keepAttributes: true }));
  const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]),
    glb = await io.writeBinary(doc),
    replay = await io.readBinary(glb),
    loaded = replay.getRoot().listMeshes()[0].listPrimitives()[0];
  const p = loaded.getAttribute('POSITION').getArray(),
    uv = loaded.getAttribute('TEXCOORD_0').getArray(),
    c = loaded.getAttribute('COLOR_0')?.getArray(),
    ix = loaded.getIndices().getArray(),
    map = replay
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === name)
      .getExtras().sourceVertexIndices;
  assert.equal(loaded.getAttribute('NORMAL'), null);
  assert.equal(ix.length, native.triangles * 3);
  if (colors) assert.equal(loaded.getAttribute('COLOR_0').getNormalized(), true);
  else assert.equal(c, undefined);
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
    if (colors)
      for (let channel = 0; channel < 4; channel++)
        assert.equal(c[slot * 4 + channel], colors[source * 4 + channel]);
  }
  const path = `${output}/${name}.glb`,
    validation = await validator.validateBytes(glb, { uri: name + '.glb' });
  assert.equal(validation.issues.numErrors, 0);
  assert.equal(validation.issues.numWarnings, 0);
  outputs.push([path, glb]);
  meshes.push({
    source: row.source,
    sourceVertices: native.sourceVertices,
    sourceTriangles: native.triangles,
    transportVertices: sourceVertices.length,
    hasVertexColors: !!colors,
    triangleReplayExact: true,
    uvReplayExact: true,
    vertexColorReplayExact: !!colors,
    normalAttributeGenerated: false,
    sourceCoordinateTransformApplied: false,
    validation: { errors: 0, warnings: 0 },
    glb: { path, bytes: glb.byteLength, sha256: sha(glb) },
  });
}
assert.equal(meshes.length, 2);
const record = {
  format: 1,
  systems: ['Ahri_W_cas', 'Ahri_W_mis', 'Ahri_W_mis_02', 'Ahri_W_tar', 'Ahri_W_weap_cas'],
  sourcePinSha256: sha(rawSource),
  decodedRecordSha256: sha(rawRecord),
  producerSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  optimization: ['dedup', 'prune with keepAttributes'],
  meshes,
  limits: [
    'Private staging only; native CPU dispatch, pivots, source-to-scene transforms, shader arithmetic and event timing remain unbound.',
    'All rendered source triangles, UVs and optional vertex colors replay exactly. An absent color stream remains absent; no normals or face colors are fabricated.',
    'Source units, coordinates and winding remain unchanged. The white unlit material is a transport placeholder.',
  ],
};
outputs.push([output + '/meshes.json', Buffer.from(JSON.stringify(record, null, 2) + '\n')]);
// Validate every destination, including the final ledger, before writing any.
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
console.log(
  JSON.stringify({
    result: 'passed',
    meshes: meshes.length,
    vertices: meshes.reduce((n, m) => n + m.sourceVertices, 0),
    triangles: meshes.reduce((n, m) => n + m.sourceTriangles, 0),
    bytes: meshes.reduce((n, m) => n + m.glb.bytes, 0),
    nativeCoordinatesPreserved: true,
    runtimeChanged: false,
  })
);
