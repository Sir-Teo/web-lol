import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read('.cache/map-textured.glb');
const root = document.getRoot();
const omitted = [];
// The source visibility mask starts at bit 0. Shared AllLayers objects are
// children of the map root; the converter duplicates multi-bit instances.
for (const node of root.listNodes()) {
  if (!/^Layer[2-8]$/.test(node.getName())) continue;
  for (const child of node.listChildren()) child.dispose();
  node.dispose();
}
await document.transform(prune());
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const material = primitive.getMaterial();
    if (!material?.getBaseColorTexture()) {
      if (!material?.getName().endsWith('/FaeLights_Prototype_Mat')) {
        throw new Error(`Unconverted base material: ${material?.getName()}`);
      }
      omitted.push({
        mesh: mesh.getName(),
        material: material.getName(),
        reason: 'Procedural Faelights indicator shader is not implemented.',
      });
      primitive.dispose();
    }
  }
}
await document.transform(prune(), dedup());
const textures = root.listTextures();
const cache = '.cache/map-webp';
await fs.mkdir(cache, { recursive: true });
for (const [index, texture] of textures.entries()) {
  if (texture.getMimeType() !== 'image/png') throw new Error('Unexpected source texture format');
  await fs.writeFile(`${cache}/${index}.png`, texture.getImage());
}
const result = spawnSync('.tools/cdtb-venv/bin/python', ['tools/assets/lossless-webp.py', cache], {
  stdio: 'inherit',
});
if (result.status !== 0) throw new Error('Lossless texture verification failed');
document.createExtension(EXTTextureWebP).setRequired(true);
for (const [index, texture] of textures.entries()) {
  texture
    .setImage(await fs.readFile(`${cache}/${index}.webp`))
    .setMimeType('image/webp')
    .setURI(`textures/${texture.getName()}.webp`);
}
// Keep original coordinates and precision. Runtime applies one documented map transform.
await document.transform(dedup(), prune());
let triangles = 0;
for (const node of root.listNodes()) {
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    triangles +=
      (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
  }
}
for (const buffer of root.listBuffers()) buffer.setURI('rift-geometry.bin');
const output = 'public/assets/maps/rift.gltf';
await io.write(output, document);
const dxt = spawnSync('.tools/cdtb-venv/bin/python', ['tools/assets/pack-map-dxt.py'], {
  stdio: 'inherit',
});
if (dxt.status !== 0) throw new Error('Original DXT texture packing failed');
const bytes = await fs.readFile(output);
const resources = [];
for (const uri of [
  'rift-geometry.bin',
  'rift-dxt.json',
  'textures/grasstint_srx.webp',
  ...root.listTextures().map((t) => t.getURI()),
  ...Object.values(JSON.parse(await fs.readFile('public/assets/maps/rift-dxt.json', 'utf8'))).map(
    (t) => t.uri
  ),
]) {
  const resource = await fs.readFile(`public/assets/maps/${uri}`);
  resources.push({
    uri,
    bytes: resource.length,
    sha256: createHash('sha256').update(resource).digest('hex'),
  });
}
const metadata = {
  referenceVersion: '16.18.8175716',
  container: 'Maps/MapGeometry/Map11/Base_SRX',
  visibilityMask: 1,
  meshes: root.listMeshes().length,
  materials: root.listMaterials().length,
  textures: root.listTextures().length,
  triangles,
  clips: [],
  textureEncoding: 'Lossless WebP, original resolution, decoded RGBA equality verified',
  source: 'docs/reference/map-extraction.json',
  omitted,
  limitations: [
    'Static geometry only; map-placeable buildings, particles, animated water, and gameplay objects are separate sources.',
    'VertexDeform and SRX_DynamicEffect use static diffuse approximations; source displacement, blending, and controller timing remain unimplemented.',
    'Other converter shader adapters approximate Riot shaders; no pixel-parity certification.',
    'Default visibility bit 0 only; elemental terrain transitions and event overrides are not implemented.',
  ],
  output: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
  resources,
};
await fs.writeFile(output.replace('.gltf', '.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata, null, 2));
