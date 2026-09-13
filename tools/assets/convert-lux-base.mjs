/** Convert the complete pinned base Lux atomic clip set to GLB. */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { resample, dedup, prune } from '@gltf-transform/functions';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const pinBytes = await readFile('docs/reference/lux-model.json');
const pin = JSON.parse(pinBytes);
const root = '.cache/lux-current-sources';
for (const f of pin.extraction.files) {
  const b = await readFile(`${root}/${f.path}`);
  if (b.length !== f.bytes || hash(b) !== f.sha256)
    throw new Error(`Lux source differs: ${f.path}`);
}
const skin = pin.skin.data['Characters/Lux/Skins/Skin0'].skinMeshProperties;
const base = '.cache/lux-current-converted';
await mkdir(base, { recursive: true });
await rm(`${base}/animations`, { recursive: true, force: true });
await mkdir(`${base}/animations`);
const clips = [];
for (const [state, source] of Object.entries(pin.atomicClips)) {
  const name = state.startsWith('{') ? `entry_${state.slice(1, -1)}` : state.toLowerCase();
  await copyFile(`${root}/${source}`, `${base}/animations/${name}.anm`);
  clips.push({ name, state, source });
}
const skn = await readFile(`${root}/${skin.simpleSkin.toLowerCase()}`);
const materials = Array.from(
  { length: skn.readUInt32LE(8) },
  (_, i) =>
    skn
      .subarray(12 + i * 80, 76 + i * 80)
      .toString('utf8')
      .split('\0')[0]
);
const raw = `${base}/lux.glb`;
execFileSync(
  '.tools/dotnet/dotnet',
  [
    '.tools/converter/lol2gltf.dll',
    'skn2gltf',
    '-m',
    `${root}/${skin.simpleSkin.toLowerCase()}`,
    '-s',
    `${root}/${skin.skeleton.toLowerCase()}`,
    '-g',
    raw,
    '-a',
    `${base}/animations`,
    '--materials',
    ...materials,
    '--textures',
    ...materials.map(() => `${root}/${skin.texture.toLowerCase()}`),
  ],
  { stdio: 'inherit' }
);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read(raw);
const unlit = doc.createExtension(KHRMaterialsUnlit);
for (const material of doc.getRoot().listMaterials())
  material.setExtension('KHR_materials_unlit', unlit.createUnlit());
const unitScale = 0.01 * skin.skinScale,
  scaled = new Set();
function scale(accessor, matrix = false) {
  if (scaled.has(accessor)) return;
  scaled.add(accessor);
  const a = accessor.getArray();
  if (matrix) {
    for (let i = 0; i < a.length; i += 16) for (const j of [12, 13, 14]) a[i + j] *= unitScale;
  } else for (let i = 0; i < a.length; i++) a[i] *= unitScale;
  accessor.setArray(a);
}
for (const mesh of doc.getRoot().listMeshes())
  for (const p of mesh.listPrimitives()) scale(p.getAttribute('POSITION'));
for (const s of doc.getRoot().listSkins()) scale(s.getInverseBindMatrices(), true);
for (const n of doc.getRoot().listNodes())
  n.setTranslation(n.getTranslation().map((v) => v * unitScale));
for (const a of doc.getRoot().listAnimations())
  for (const c of a.listChannels())
    if (c.getTargetPath() === 'translation') scale(c.getSampler().getOutput());
// glTF requires unused influence slots to name joint zero. They contribute no
// deformation; keep every nonzero-weight joint and weight exactly as converted.
let canonicalizedJointSlots = 0;
for (const m of doc.getRoot().listMeshes())
  for (const p of m.listPrimitives()) {
    const joints = p.getAttribute('JOINTS_0');
    const weights = p.getAttribute('WEIGHTS_0').getArray();
    const array = joints.getArray();
    for (let i = 0; i < array.length; i++)
      if (weights[i] === 0 && array[i] !== 0) {
        array[i] = 0;
        canonicalizedJointSlots++;
      }
    joints.setArray(array);
  }
await doc.transform(resample(), dedup(), prune());
for (const clip of clips) {
  const animation = doc
    .getRoot()
    .listAnimations()
    .find((a) => a.getName() === clip.name);
  if (!animation) throw new Error(`Missing clip: ${clip.name}`);
  clip.durationSeconds = Math.max(
    ...animation.listSamplers().map((s) => Math.max(...s.getInput().getArray()))
  );
}
doc.getRoot().getAsset().copyright = 'Lux artwork and animation © Riot Games. Reference content.';
doc.getRoot().getAsset().generator = 'web-lol pinned base Lux converter; lol2gltf + glTF Transform';
const bytes = await io.writeBinary(doc);
await mkdir('public/assets/models', { recursive: true });
await writeFile('public/assets/models/lux-base.glb', bytes);
const manifest = {
  referenceVersion: pin.extraction.referenceVersion,
  status:
    'Pinned base skin mesh and all atomic clips; animation graph transitions, events, locomotion selection and reference lighting/pose calibration remain unfinished.',
  output: { path: '/assets/models/lux-base.glb', bytes: bytes.length, sha256: hash(bytes) },
  definitionsSha256: hash(pinBytes),
  sourceManifest: pin.extraction.manifest,
  sourceArchive: pin.extraction.archive,
  sources: pin.extraction.files,
  unitScale,
  canonicalizedJointSlots,
  skinScale: skin.skinScale,
  materialPolicy:
    'Source texture with unlit shading; source selfIllumination lighting calibration remains unfinished.',
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
await writeFile('public/assets/models/lux-base.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    bytes: bytes.length,
    triangles: manifest.triangles,
    bones: manifest.bones,
    clips: clips.map((c) => [c.name, c.durationSeconds]),
  })
);
