/** Package frozen Oracle geometry and textures; emitter playback remains separate. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';

execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-oracle-lens.py'], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: '.tools/cdtb' },
});
const data = JSON.parse(await readFile('.cache/oracle-lens/decoded.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const names = {
  global_trinket_greaterspotter_radar: 'oracle-lens-radar',
  global_trinket_spotter_corelaser: 'oracle-lens-core-laser',
  global_trinket_spotter_laser: 'oracle-lens-laser',
};
const io = new NodeIO(),
  outputs = [];
for (const source of data.meshes) {
  const name = names[source.source.path.split('/').at(-1).replace('.scb', '')];
  assert.ok(name, 'Unexpected Oracle mesh');
  const doc = new Document(),
    buffer = doc.createBuffer();
  const attr = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const positions = Float32Array.from(source.positions, (v) => v * 0.01);
  const uv = new Float32Array(source.uv);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', attr('VEC3', positions))
    .setAttribute('TEXCOORD_0', attr('VEC2', uv));
  if (source.sourceFaceRGB)
    primitive.setAttribute(
      '_SOURCE_FACE_RGB',
      attr('VEC3', new Uint8Array(source.sourceFaceRGB)).setNormalized(true)
    );
  const metadata = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !['positions', 'uv', 'sourceFaceRGB', 'sourceIndices'].includes(key)
    )
  );
  doc
    .createScene()
    .addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)))
    .setExtras({
      ...metadata,
      unitScale: 0.01,
      note: 'Source face corners/UVs and optional RGB retained. No pivot offset, reflection, winding, emitter transform or particle material applied. Missing source face colors stay absent. Raw face RGB is not a runtime tint.',
    });
  doc.getRoot().getAsset().copyright = 'Oracle Lens artwork © Riot Games. Reference content.';
  const bytes = await io.writeBinary(doc),
    report = await validator.validateBytes(bytes);
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const restored = (await io.readBinary(bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
  for (const key of primitive.listSemantics())
    assert.deepEqual(restored.getAttribute(key).getArray(), primitive.getAttribute(key).getArray());
  assert.equal(!!restored.getAttribute('_SOURCE_FACE_RGB'), source.sourceFaceRGB !== null);
  assert.equal(restored.getIndices(), null);
  const path = `public/assets/models/${name}.glb`;
  await writeFile(path, bytes);
  const manifest = {
    ...metadata,
    output: { path: path.replace('public', ''), bytes: bytes.length, sha256: hash(bytes) },
    sourcePinSha256: data.sourcePinSha256,
    unitScale: 0.01,
    exportedCorners: positions.length / 3,
    positionFloat32Sha256: hash(Buffer.from(positions.buffer)),
    uvFloat32Sha256: hash(Buffer.from(uv.buffer)),
    faceRgbSha256: source.sourceFaceRGB ? hash(new Uint8Array(source.sourceFaceRGB)) : null,
    sourceIndicesSha256: hash(Buffer.from(new Uint32Array(source.sourceIndices).buffer)),
    validation: { errors: 0, warnings: 0, roundTripAttributesExact: true },
  };
  await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
  outputs.push(manifest);
}
const rig = JSON.parse(await readFile('public/assets/models/oracle-lens-base.json'));
assert.equal(rig.definitionsSha256, data.sourcePinSha256);
await writeFile(
  'docs/reference/oracle-lens-assets.json',
  JSON.stringify(
    {
      sourcePinSha256: data.sourcePinSha256,
      layoutReference: data.layoutReference,
      rig: { output: rig.output, triangles: rig.triangles, bones: rig.bones, clips: rig.clips },
      meshes: outputs,
      textures: data.textures,
      status:
        'All frozen visual dependencies packaged. These conversions do not establish native particle playback or a functioning Oracle Lens.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify({
    staticMeshes: outputs.length,
    triangles: outputs.reduce((n, m) => n + m.triangles, 0),
    textures: data.textures.length,
    rigBytes: rig.output.bytes,
  })
);
