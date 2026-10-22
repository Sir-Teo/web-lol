/** Convert pinned base rigs; preview materials preserve source diffuse assignments. */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { resample, dedup, prune } from '@gltf-transform/functions';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const champion = process.argv[2];
if (
  ![
    'Garen',
    'Ahri',
    'SRU_Blue',
    'SRU_Gromp',
    'SRU_Red',
    'SRU_Murkwolf',
    'SRU_MurkwolfMini',
    'SRU_Razorbeak',
    'SRU_RazorbeakMini',
    'SRU_Krug',
    'SRU_KrugMini',
    'SRU_KrugMiniMini',
    'Sru_Crab',
  ].includes(champion)
)
  throw new Error('Expected a supported champion or ordinary jungle base rig');
const jungle = /^sru_/i.test(champion);
const sourceSlug = champion.toLowerCase();
const slug = sourceSlug.replaceAll('_', '-');
const sourceGroup =
  champion === 'SRU_Red'
    ? 'red-brambleback'
    : champion.startsWith('SRU_Murkwolf')
      ? 'wolf-camps'
      : champion.startsWith('SRU_Razorbeak')
        ? 'raptor-camps'
        : champion.startsWith('SRU_Krug')
          ? 'krug-camps'
          : champion === 'Sru_Crab'
            ? 'scuttler'
            : null;
const pinBytes = await readFile(
  sourceGroup
    ? `docs/reference/${sourceGroup}-source.json`
    : jungle
      ? 'docs/reference/jungle-character-source.json'
      : `docs/reference/${slug}-model.json`
);
const sourcePin = JSON.parse(pinBytes);
const pin = jungle
  ? {
      extraction: sourcePin.extraction,
      skin: { data: sourcePin.records[`data/characters/${sourceSlug}/skins/skin0.bin`] },
      atomicClips: sourcePin.models[champion].atomicClips,
    }
  : sourcePin;
const root = sourceGroup
  ? `.cache/${sourceGroup}`
  : jungle
    ? '.cache/jungle-characters'
    : `.cache/${slug}-current-sources`;
for (const f of pin.extraction.files) {
  const b = await readFile(`${root}/${f.path}`);
  if (b.length !== f.bytes || hash(b) !== f.sha256)
    throw new Error(`${champion} source differs: ${f.path}`);
}
const skin = pin.skin.data[`Characters/${champion}/Skins/Skin0`].skinMeshProperties;
const base = `.cache/${slug}-current-converted`;
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
function diffuse(name) {
  const override = skin.materialOverride?.find((o) =>
    jungle ? o.submesh.toLowerCase() === name.toLowerCase() : o.submesh === name
  );
  if (override?.texture) return override.texture.toLowerCase();
  if (override?.Material) {
    const definition = pin.skin.data[override.Material];
    const sampler = definition?.samplerValues?.find((s) => s.TextureName === 'Diffuse_Texture');
    if (!sampler) throw new Error(`Missing diffuse sampler for ${name}`);
    return sampler.texturePath.toLowerCase();
  }
  return skin.texture.toLowerCase();
}
const hidden = (skin.initialSubmeshToHide ?? '').split(jungle ? /[,\s]+/ : ' ').filter(Boolean);
const raw = `${base}/${slug}.glb`;
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
    ...materials.map((name) => `${root}/${diffuse(name)}`),
  ],
  { stdio: 'inherit' }
);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read(raw);
const unlit = doc.createExtension(KHRMaterialsUnlit);
for (const material of doc.getRoot().listMaterials()) {
  material.setExtension('KHR_materials_unlit', unlit.createUnlit());
  const name = material.getName();
  material.setExtras({
    sourceSubmesh: name,
    defaultHidden: hidden.some((entry) =>
      jungle ? entry.toLowerCase() === name.toLowerCase() : entry === name
    ),
  });
  const override = skin.materialOverride?.find((o) => o.submesh === name);
  const definition = override?.Material && pin.skin.data[override.Material];
  if (definition?.techniques?.[0]?.passes?.[0]?.blendEnable) material.setAlphaMode('BLEND');
}

const unitScale = 0.01 * (skin.skinScale ?? 1),
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
doc
  .getRoot()
  .getAsset().copyright = `${champion} artwork and animation © Riot Games. Reference content.`;
doc
  .getRoot()
  .getAsset().generator = `web-lol pinned base ${champion} converter; lol2gltf + glTF Transform`;
const bytes = await io.writeBinary(doc);
const { validateBytes } = await import('gltf-validator');
const validation = await validateBytes(bytes);
if (validation.issues.numErrors || validation.issues.numWarnings)
  throw new Error(JSON.stringify(validation.issues));
await mkdir('public/assets/models', { recursive: true });
await writeFile(`public/assets/models/${slug}-base.glb`, bytes);
const manifest = {
  referenceVersion: pin.extraction.referenceVersion,
  status:
    'Pinned base skin mesh and all atomic clips; animation graph transitions, events, locomotion selection and reference lighting/pose calibration remain unfinished.',
  output: { path: `/assets/models/${slug}-base.glb`, bytes: bytes.length, sha256: hash(bytes) },
  definitionsSha256: hash(pinBytes),
  sourceManifest: pin.extraction.manifest,
  sourceArchive: pin.extraction.archive,
  sources: pin.extraction.files,
  unitScale,
  canonicalizedJointSlots,
  skinScale: skin.skinScale ?? 1,
  skinScalePolicy: 'Omitted source scale uses identity; native scale calibration remains open.',
  initialSubmeshesToHide: hidden,
  materialTextures: Object.fromEntries(materials.map((name) => [name, diffuse(name)])),
  materialPolicy:
    'Source diffuse assignment with unlit preview shading and authored blend flags. Reflection/gloss, dynamic ultimate materials, rig pose modifiers and native shading remain unfinished. Hidden submeshes retained with defaultHidden material metadata.',
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
await writeFile(`public/assets/models/${slug}-base.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    bytes: bytes.length,
    triangles: manifest.triangles,
    bones: manifest.bones,
    clips: clips.map((c) => [c.name, c.durationSeconds]),
  })
);
