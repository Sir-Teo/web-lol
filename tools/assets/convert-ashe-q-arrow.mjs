/** Preserve the active Q icearrow mesh; particle placement and flurry timing are separate. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import validator from 'gltf-validator';

execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-ashe-q-arrow.py'], {
  env: { ...process.env, PYTHONPATH: '.tools/cdtb:tools/assets' },
  stdio: 'inherit',
});
const decoded = JSON.parse(await readFile('.cache/q-arrow/decoded.json'));
const pin = JSON.parse(await readFile('docs/reference/ashe-q-arrow.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const doc = new Document();
const buffer = doc.createBuffer();
const accessor = (type, array) =>
  doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const texture = doc
  .createTexture('Source ice arrow')
  .setMimeType('image/png')
  .setImage(await readFile(decoded.textures[0].path));
const unlit = doc.createExtension(KHRMaterialsUnlit);
const material = doc
  .createMaterial('icearrow')
  .setBaseColorTexture(texture)
  .setAlphaMode('BLEND')
  .setExtension('KHR_materials_unlit', unlit.createUnlit())
  .setExtras({ sourceBlendMode: 3, sourceEmitter: 'icearrow' });
const primitive = doc
  .createPrimitive()
  .setAttribute(
    'POSITION',
    accessor(
      'VEC3',
      Float32Array.from(decoded.positions, (v) => v * 0.01)
    )
  )
  .setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(decoded.uv)))
  .setAttribute('COLOR_0', accessor('VEC4', new Uint8Array(decoded.rgba)).setNormalized(true))
  .setIndices(
    accessor(
      'SCALAR',
      Uint16Array.from(decoded.sourceIndices, (_, i) => i)
    )
  )
  .setMaterial(material);
const mesh = doc.createMesh('Ashe source ice arrow').addPrimitive(primitive);
doc
  .createScene()
  .addChild(doc.createNode('icearrow').setMesh(mesh))
  .setExtras({ sourceEmitter: decoded.sourceEmitter, unitScale: 0.01, sourcePivot: decoded.pivot });
doc.getRoot().getAsset().copyright = 'Ashe artwork © Riot Games. Reference content.';
const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]);
const bytes = await io.writeBinary(doc);
const validation = await validator.validateBytes(bytes);
if (validation.issues.numErrors || validation.issues.numWarnings)
  throw new Error(`Invalid Q arrow GLB: ${JSON.stringify(validation.issues)}`);
const restored = await io.readBinary(bytes);
const result = restored.getRoot().listMeshes()[0].listPrimitives()[0];
for (const name of ['POSITION', 'TEXCOORD_0', 'COLOR_0']) {
  const before = primitive.getAttribute(name).getArray(),
    after = result.getAttribute(name).getArray();
  if (before.length !== after.length || before.some((v, i) => v !== after[i]))
    throw new Error(`Changed ${name}`);
}
if (
  result.getIndices().getCount() !== decoded.triangles * 3 ||
  result
    .getIndices()
    .getArray()
    .some((v, i) => v !== i)
)
  throw new Error('Changed topology');
if (hash(restored.getRoot().listTextures()[0].getImage()) !== decoded.textures[0].pngSha256)
  throw new Error('Changed texture');
const output = 'public/assets/models/ashe-q-arrow.glb';
await writeFile(output, bytes);
await writeFile(
  'docs/reference/ashe-q-arrow-conversion.json',
  JSON.stringify(
    {
      status:
        'Prepared source geometry; runtime particle placement and five-arrow sequencing are not integrated.',
      output: { path: '/assets/models/ashe-q-arrow.glb', bytes: bytes.length, sha256: hash(bytes) },
      definitionPinSha256: hash(await readFile('docs/reference/ashe-q-arrow.json')),
      sourceArchive: pin.extraction.archive,
      sourceManifest: pin.extraction.manifest,
      sources: decoded.sources,
      sourceVertices: decoded.sourceVertices,
      triangles: decoded.triangles,
      texture: decoded.textures[0],
      unitScale: 0.01,
      sourcePivot: decoded.pivot,
      emitterTransformApplied: false,
      readerReference:
        'https://github.com/LeagueToolkit/LeagueToolkit/tree/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Mesh',
      checks: [
        'Exact face order',
        'Exact float32 positions after unit conversion',
        'Exact UVs and vertex RGBA',
        'Exact embedded PNG bytes',
      ],
    },
    null,
    2
  ) + '\n'
);
console.log(`Prepared ${decoded.triangles} source triangles, ${bytes.length} bytes`);
