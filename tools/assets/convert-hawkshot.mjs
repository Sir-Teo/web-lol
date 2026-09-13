/** Convert the pinned Hawkshot Owl1/Owl2 mesh, textures and source animation to GLB. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pinBytes = await readFile('docs/reference/hawkshot-effects.json');
const pin = JSON.parse(pinBytes);
const blendPinBytes = await readFile('docs/reference/hawkshot-blending.json');
const blendPin = JSON.parse(blendPinBytes);
const fresnelPinBytes = await readFile('docs/reference/hawkshot-fresnel.json');
const sourceRoot = '.cache/hawkshot-sources';
for (const file of pin.extraction.files) {
  const bytes = await readFile(`${sourceRoot}/${file.path}`);
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
    throw new Error(`Hawkshot source differs: ${file.path}`);
}
const definition = pin.records['Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_E_mis'].data;
const emitter = definition.complexEmitterDefinitionData.find((e) => e.emitterName === 'Owl1');
if (emitter.primitive.__type !== 'VfxPrimitiveMesh' || emitter.isUniformScale !== 1)
  throw new Error('Hawkshot mesh/scale interpretation must be reviewed');
if (emitter.blendMode !== blendPin.selectedMode || blendPin.selectedMode !== 4)
  throw new Error('Hawkshot blend interpretation must be reviewed');
const rim = definition.complexEmitterDefinitionData.find((e) => e.emitterName === 'Owl2');
for (const field of ['primitive', 'isUniformScale', 'birthScale0', 'birthRotation0', 'blendMode'])
  if (JSON.stringify(rim[field]) !== JSON.stringify(emitter[field]))
    throw new Error(`Hawkshot layers no longer share ${field}`);
const mesh = emitter.primitive.mMesh;
const source = (path) => `${sourceRoot}/${path.toLowerCase()}`;
const converted = '.cache/hawkshot-converted';
await mkdir(`${converted}/animations`, { recursive: true });
await mkdir('public/assets/models', { recursive: true });
await copyFile(source(mesh.mAnimationName), `${converted}/animations/flight.anm`);
const meshBytes = await readFile(source(mesh.mMeshName));
const materialNames = Array.from(
  { length: meshBytes.readUInt32LE(8) },
  (_, i) =>
    meshBytes
      .subarray(12 + i * 80, 76 + i * 80)
      .toString('utf8')
      .split('\0')[0]
);
function convertLayer(rawPath, texture) {
  execFileSync(
    '.tools/dotnet/dotnet',
    [
      '.tools/converter/lol2gltf.dll',
      'skn2gltf',
      '-m',
      source(mesh.mMeshName),
      '-s',
      source(mesh.mMeshSkeletonName),
      '-g',
      rawPath,
      '-a',
      `${converted}/animations`,
      '--materials',
      ...materialNames,
      '--textures',
      ...materialNames.map(() => source(texture)),
    ],
    { stdio: 'inherit' }
  );
}
const rawPath = `${converted}/hawkshot.glb`;
convertLayer(rawPath, emitter.texture);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(rawPath);
const unitScale = 0.01 * emitter.birthScale0.constantValue[0];
const scaled = new Set();
function scale(accessor, matrix = false) {
  if (scaled.has(accessor)) return;
  scaled.add(accessor);
  const values = accessor.getArray();
  if (matrix) {
    for (let i = 0; i < values.length; i += 16)
      for (const j of [12, 13, 14]) values[i + j] *= unitScale;
  } else for (let i = 0; i < values.length; i++) values[i] *= unitScale;
  accessor.setArray(values);
}
for (const m of doc.getRoot().listMeshes())
  for (const p of m.listPrimitives()) scale(p.getAttribute('POSITION'));
for (const skin of doc.getRoot().listSkins()) scale(skin.getInverseBindMatrices(), true);
for (const node of doc.getRoot().listNodes())
  node.setTranslation(node.getTranslation().map((v) => v * unitScale));
for (const animation of doc.getRoot().listAnimations())
  for (const channel of animation.listChannels())
    if (channel.getTargetPath() === 'translation') scale(channel.getSampler().getOutput());
const unlit = doc.createExtension(KHRMaterialsUnlit);
for (const material of doc.getRoot().listMaterials()) {
  material.setBaseColorFactor(emitter.Color.constantValue);
  // glTF has no native additive mode; the runtime restores this source state.
  material.setExtras({ sourceBlendMode: emitter.blendMode, sourceEmitter: emitter.emitterName });
  material.setAlphaMode('BLEND').setDoubleSided(true);
  material.setExtension('KHR_materials_unlit', unlit.createUnlit());
}
const rimPath = `${converted}/hawkshot-rim.glb`;
convertLayer(rimPath, rim.texture);
const rimDoc = await io.read(rimPath);
const hold = rimDoc.getRoot().listMaterials()[0].getBaseColorTexture();
const rimTexture = doc
  .createTexture('Owl2 source color hold')
  .setImage(hold.getImage())
  .setMimeType(hold.getMimeType());
const rimMaterial = doc
  .createMaterial('Owl2 Fresnel rim')
  .setBaseColorFactor(rim.birthColor.constantValue)
  .setBaseColorTexture(rimTexture)
  .setAlphaMode('BLEND')
  .setDoubleSided(rim.disableBackfaceCull)
  .setExtension('KHR_materials_unlit', unlit.createUnlit())
  .setExtras({
    sourceBlendMode: rim.blendMode,
    sourceEmitter: rim.emitterName,
    fresnel: rim.reflectionDefinition.fresnel,
    fresnelColor: rim.reflectionDefinition.fresnelColor,
  });
for (const m of doc.getRoot().listMeshes()) {
  const primitives = m.listPrimitives();
  for (const primitive of primitives) {
    if (!primitive.getAttribute('NORMAL')) throw new Error('Hawkshot rim requires source normals');
    m.addPrimitive(primitive.clone().setMaterial(rimMaterial));
  }
}
doc
  .getRoot()
  .listScenes()[0]
  .setExtras({
    emitterRotationDegrees: emitter.birthRotation0.constantValue,
    sourceEmitters: ['Owl1', 'Owl2'],
  });
const asset = doc.getRoot().getAsset();
asset.copyright = 'Hawkshot artwork and animation © Riot Games. Reference content.';
asset.generator = 'web-lol Hawkshot converter; lol2gltf + glTF Transform';
// The custom rim shader consumes normals even though portable unlit glTF does not.
await doc.transform(resample(), dedup(), prune({ keepAttributes: true, keepSolidTextures: true }));
const clips = doc
  .getRoot()
  .listAnimations()
  .map((a) => ({
    name: a.getName(),
    source: mesh.mAnimationName.toLowerCase(),
    durationSeconds: Math.max(...a.listSamplers().map((s) => Math.max(...s.getInput().getArray()))),
  }));
if (clips.length !== 1 || clips[0].name !== 'flight' || clips[0].durationSeconds <= 0)
  throw new Error('Hawkshot flight animation is missing');
const bytes = await io.writeBinary(doc);
const path = 'public/assets/models/hawkshot.glb';
await writeFile(path, bytes);
const manifest = {
  referenceVersion: pin.extraction.referenceVersion,
  status:
    'Source Owl1 body, Owl2 Fresnel rim and animation. Other particle layers and reference capture/transform parity remain unfinished.',
  definitionsSha256: hash(pinBytes),
  blendInterpretationSha256: hash(blendPinBytes),
  fresnelInterpretationSha256: hash(fresnelPinBytes),
  blendInterpretationSource: blendPin.source.url,
  output: { path: '/assets/models/hawkshot.glb', bytes: bytes.length, sha256: hash(bytes) },
  sourceManifest: pin.extraction.manifest,
  sourceArchive: pin.extraction.archive,
  sources: pin.extraction.files.filter((f) =>
    [
      mesh.mMeshName,
      mesh.mMeshSkeletonName,
      mesh.mAnimationName,
      emitter.texture,
      rim.texture,
    ].some((p) => p.toLowerCase() === f.path)
  ),
  unitScale,
  emitterRotationDegrees: emitter.birthRotation0.constantValue,
  sourceBlendMode: emitter.blendMode,
  materialPolicy:
    'Unlit source Owl1 and Owl2 color/textures with runtime vertex Fresnel for Owl2; source mode 4 restored at runtime as SRC_ALPHA + ONE additive blending, per pinned dictionary. glTF alpha BLEND is the portable fallback.',
  clips,
  triangles: doc
    .getRoot()
    .listMeshes()
    .reduce(
      (n, m) => n + m.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0),
      0
    ),
  bones: doc.getRoot().listSkins()[0].listJoints().length,
};
await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    bytes: bytes.length,
    triangles: manifest.triangles,
    bones: manifest.bones,
    clips,
  })
);
