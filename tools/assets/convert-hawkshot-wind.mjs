/** Prepare source wind geometry and textures; emission/erosion playback is a separate runtime step. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { format, resolveConfig } from 'prettier';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';

execFileSync('.tools/cdtb-venv/bin/python', ['tools/assets/decode-hawkshot-wind.py'], {
  env: { ...process.env, PYTHONPATH: '.tools/cdtb:tools/assets' },
  stdio: 'inherit',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decoded = JSON.parse(await readFile('.cache/hawkshot-wind/decoded.json'));
const pin = JSON.parse(await readFile('docs/reference/hawkshot-effects.json'));
const doc = new Document();
const buffer = doc.createBuffer();
const accessor = (type, array) =>
  doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const positions = accessor('VEC3', new Float32Array(decoded.positions.map((v) => v * 0.01)));
const uvs = accessor('VEC2', new Float32Array(decoded.uv));
const colors = accessor('VEC4', new Uint8Array(decoded.rgba)).setNormalized(true);
const indices = accessor(
  'SCALAR',
  Uint16Array.from(decoded.sourceIndices, (_, i) => i)
);
const colorTexture = doc
  .createTexture('Source wind swirl')
  .setMimeType('image/png')
  .setImage(await readFile(decoded.textures[0].path));
const erosionPath = '/assets/effects/hawkshot-wind-erosion.png';
const unlit = doc.createExtension(KHRMaterialsUnlit);
const emitter = decoded.sourceEmitter;
const material = doc
  .createMaterial('WindTunnel')
  .setBaseColorTexture(colorTexture)
  .setBaseColorFactor(emitter.Color.constantValue)
  .setAlphaMode('BLEND')
  .setDoubleSided(emitter.disableBackfaceCull)
  .setExtension('KHR_materials_unlit', unlit.createUnlit())
  .setExtras({
    sourceEmitter: emitter.emitterName,
    sourceBlendMode: emitter.blendMode,
    erosionTexture: erosionPath,
    erosionColorSpace: 'linear',
  });
const primitive = doc
  .createPrimitive()
  .setAttribute('POSITION', positions)
  .setAttribute('TEXCOORD_0', uvs)
  .setAttribute('COLOR_0', colors)
  .setIndices(indices)
  .setMaterial(material);
const mesh = doc.createMesh(decoded.name).addPrimitive(primitive);
doc
  .createScene()
  .addChild(doc.createNode('WindTunnel source mesh').setMesh(mesh))
  .setExtras({ sourceEmitter: emitter, unitScale: 0.01, sourcePivot: decoded.pivot });
doc.getRoot().getAsset().copyright = 'Hawkshot artwork © Riot Games. Reference content.';
doc.getRoot().getAsset().generator = 'web-lol pinned SCB/TEX wind converter';
const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]);
const bytes = await io.writeBinary(doc);
await mkdir('public/assets/effects', { recursive: true });
await mkdir('public/assets/models', { recursive: true });
await copyFile(decoded.textures[1].path, `public${erosionPath}`);
const path = 'public/assets/models/hawkshot-wind.glb';
await writeFile(path, bytes);
// Read the shipped binary back: topology, corners, UVs, and vertex alpha must survive exactly.
const roundtrip = await io.readBinary(bytes);
const restored = roundtrip.getRoot().listMeshes()[0].listPrimitives()[0];
for (const semantic of ['POSITION', 'TEXCOORD_0', 'COLOR_0']) {
  const before = primitive.getAttribute(semantic).getArray();
  const after = restored.getAttribute(semantic).getArray();
  if (before.length !== after.length || before.some((v, i) => v !== after[i]))
    throw new Error(`Wind export changed ${semantic}`);
}
if (hash(roundtrip.getRoot().listTextures()[0].getImage()) !== decoded.textures[0].pngSha256)
  throw new Error('Wind export changed the source texture bytes');
const restoredIndices = restored.getIndices().getArray();
if (restoredIndices.length !== decoded.triangles * 3 || restoredIndices.some((v, i) => v !== i))
  throw new Error('Wind export changed source face order');
const manifest = {
  referenceVersion: pin.extraction.referenceVersion,
  status:
    'Source assets for runtime wind emission and erosion. Exact timing, placement and shutdown parity remain unverified.',
  output: { path: '/assets/models/hawkshot-wind.glb', bytes: bytes.length, sha256: hash(bytes) },
  auxiliaryAssets: [
    {
      path: erosionPath,
      bytes: (await readFile(`public${erosionPath}`)).length,
      sha256: decoded.textures[1].pngSha256,
    },
  ],
  definitionsSha256: decoded.definitionsSha256,
  sourceArchive: pin.extraction.archive,
  sourceManifest: pin.extraction.manifest,
  sources: decoded.sources,
  meshReaderReference:
    'https://github.com/LeagueToolkit/LeagueToolkit/tree/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Mesh',
  unitScale: 0.01,
  sourceVertices: decoded.sourceVertices,
  exportedVertices: decoded.sourceIndices.length,
  triangles: decoded.triangles,
  bones: 0,
  clips: [],
  textures: decoded.textures.map(({ path, ...texture }) => ({
    ...texture,
    output: texture.name === 'color' ? 'embedded in GLB' : erosionPath,
  })),
  policy:
    'Source positions scaled from centimeters, UVs and face winding preserved, per-corner UV seams expanded, BGRA vertex bytes mapped to normalized RGBA. Emitter scale/rotation remain runtime parameters. Erosion texture is linear data; runtime must sample its green channel.',
};
await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    bytes: bytes.length,
    triangles: manifest.triangles,
    exportedVertices: manifest.exportedVertices,
  })
);

const playbackBytes = await readFile('docs/reference/hawkshot-wind-playback.json');
const playback = JSON.parse(playbackBytes);
const wind = {
  delay: emitter.timeBeforeFirstEmission,
  rate: emitter.rate.constantValue,
  lifetime: emitter.particleLifetime.dynamics.values[0],
  lifeRange: emitter.particleLifetime.dynamics.probabilityTables[0].keyValues,
  velocity: emitter.birthVelocity.dynamics.values[0],
  drag: emitter.birthDrag.constantValue,
  rotation: emitter.birthRotation0.dynamics.values[0],
  rotationRange: emitter.birthRotation0.dynamics.probabilityTables[1].keyValues,
  rotationalVelocity: emitter.birthRotationalVelocity0.constantValue,
  scale: emitter.birthScale0.dynamics.values[0],
  scaleRanges: emitter.birthScale0.dynamics.probabilityTables.map((p) => p.keyValues),
  colorTimes: emitter.Color.dynamics.times,
  colors: emitter.Color.dynamics.values,
  erosionTimes: emitter.alphaErosionDefinition.erosionDriveCurve.dynamics.times,
  erosionValues: emitter.alphaErosionDefinition.erosionDriveCurve.dynamics.values,
  erosion: playback.erosion,
  linger: emitter.particleLinger,
};
await writeFile(
  'src/content/hawkshot-wind.ts',
  await format(
    `// Generated from pinned Hawkshot WindTunnel. Definitions ${decoded.definitionsSha256}; playback ${hash(playbackBytes)}.\nexport const HAWKSHOT_WIND = ${JSON.stringify(wind, null, 2)} as const;\n`,
    { ...(await resolveConfig('src/content/hawkshot-wind.ts')), parser: 'typescript' }
  )
);
