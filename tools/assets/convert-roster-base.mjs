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
    'SRU_Jungle_Companions',
    'SRU_Baron',
    'SRU_RiftHerald',
    'SRU_Horde',
    'SightWard',
    'OracleLens',
  ].includes(champion)
)
  throw new Error('Expected a supported champion, jungle or epic-objective base rig');
const ward = champion === 'SightWard';
const oracle = champion === 'OracleLens';
const jungle = /^sru_/i.test(champion);
const companion = champion === 'SRU_Jungle_Companions';
const epic = ['SRU_Baron', 'SRU_RiftHerald', 'SRU_Horde'].includes(champion);
const options = process.argv.slice(3);
const skinIndex = Number(
  options[0] !== undefined && !options[0].startsWith('--') ? options.shift() : 0
);
if (!Number.isInteger(skinIndex) || skinIndex < 0 || skinIndex > (companion ? 2 : 0))
  throw new Error('Unsupported source skin index');
let outputDirectory = 'public/assets/models';
if (options.length) {
  if (options.length !== 2 || options[0] !== '--output-dir')
    throw new Error('Use an optional skin index followed by --output-dir <relative directory>');
  outputDirectory = options[1].replace(/\/+$/, '');
  if (
    !/^[a-zA-Z0-9._/-]+$/.test(outputDirectory) ||
    outputDirectory.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Output directory must stay relative to the project');
}
const outputUrl = `/${outputDirectory.replace(/^public(?:\/|$)/, '')}`.replace(/\/$/, '');
const sourceSlug = champion.toLowerCase();
const slug = oracle
  ? 'oracle-lens'
  : sourceSlug.replaceAll('_', '-') + (companion ? `-skin${skinIndex}` : '');
const sourceGroup = epic
  ? 'epic-models'
  : oracle
    ? 'oracle-lens'
    : ward
      ? 'warding-totem'
      : champion === 'SRU_Red'
        ? 'red-brambleback'
        : champion.startsWith('SRU_Murkwolf')
          ? 'wolf-camps'
          : champion.startsWith('SRU_Razorbeak')
            ? 'raptor-camps'
            : champion.startsWith('SRU_Krug')
              ? 'krug-camps'
              : champion === 'Sru_Crab'
                ? 'scuttler'
                : companion
                  ? 'jungle-companions'
                  : null;
const pinBytes = await readFile(
  sourceGroup
    ? `docs/reference/${sourceGroup}-source.json`
    : jungle
      ? 'docs/reference/jungle-character-source.json'
      : `docs/reference/${slug}-model.json`
);
const sourcePin = JSON.parse(pinBytes);
const oracleEmitter = oracle
  ? sourcePin.items.records['Items/3364/Particles/3364_Buff'].complexEmitterDefinitionData.find(
      (e) => e.emitterName === 'Trinket_Red'
    )
  : null;
const pin = oracle
  ? {
      extraction: sourcePin.extraction,
      atomicClips: { buff: oracleEmitter.primitive.mMesh.mAnimationName.toLowerCase() },
    }
  : jungle || ward
    ? {
        extraction: sourcePin.extraction,
        skin: {
          data: sourcePin.records[`data/characters/${sourceSlug}/skins/skin${skinIndex}.bin`],
        },
        atomicClips: ward
          ? sourcePin.model.atomicClips
          : sourcePin.models[companion ? `${champion}/Skin${skinIndex}` : champion].atomicClips,
      }
    : sourcePin;
const root = oracle
  ? '.cache/oracle-lens/original'
  : sourceGroup
    ? `.cache/${sourceGroup}`
    : jungle
      ? '.cache/jungle-characters'
      : `.cache/${slug}-current-sources`;
for (const f of pin.extraction.files) {
  const b = await readFile(`${root}/${f.path}`);
  if (b.length !== f.bytes || hash(b) !== f.sha256)
    throw new Error(`${champion} source differs: ${f.path}`);
}
// This is a particle mesh binding, not a character skin or animation graph.
const skin = oracle
  ? {
      simpleSkin: oracleEmitter.primitive.mMesh.mMeshName,
      skeleton: oracleEmitter.primitive.mMesh.mMeshSkeletonName,
      texture: oracleEmitter.texture,
    }
  : pin.skin.data[`Characters/${champion}/Skins/Skin${skinIndex}`].skinMeshProperties;
const bindingBytes = epic ? await readFile('docs/reference/epic-models-bindings.json') : null;
const bindingAudit = bindingBytes ? JSON.parse(bindingBytes) : null;
const unboundSourceAnimations = [];
if (epic) {
  if (
    bindingAudit.sourcePinSha256 !== hash(pinBytes) ||
    bindingAudit.helperSha256 !==
      hash(await readFile('tools/assets/inspect-animation-bindings.cs')) ||
    bindingAudit.toolkitSha256 !== hash(await readFile('.tools/converter/LeagueToolkit.dll'))
  )
    throw new Error('Animation binding audit source/toolchain differs');
  const model = bindingAudit.models.find((model) => model.name === champion);
  const skeleton = pin.extraction.files.find((file) => file.path === skin.skeleton.toLowerCase());
  if (!model || model.skeletonSha256 !== skeleton.sha256)
    throw new Error('Animation binding skeleton differs');
  const byState = new Map(model.clips.map((clip) => [clip.state, clip]));
  if (byState.size !== Object.keys(pin.atomicClips).length)
    throw new Error('Animation binding graph coverage differs');
  const joints = new Map(model.joints.map((joint) => [joint.hash, joint.name]));
  for (const [state, source] of Object.entries(pin.atomicClips)) {
    const clip = byState.get(state);
    const file = pin.extraction.files.find((file) => file.path === source);
    if (!clip || clip.source !== source || clip.sha256 !== file.sha256)
      throw new Error('Animation binding clip source differs');
    const matched = clip.sourceJointHashes
      .filter((hash) => joints.has(hash))
      .map((hash) => joints.get(hash));
    if (
      !clip.sourceJointHashes.length ||
      JSON.stringify(matched) !== JSON.stringify(clip.matchedRigJoints) ||
      clip.unbound !== (matched.length === 0)
    )
      throw new Error('Animation binding classification differs');
    if (clip.unbound)
      unboundSourceAnimations.push({
        state,
        source,
        sourceSha256: clip.sha256,
        durationSeconds: clip.duration,
        sourceJointHashes: clip.sourceJointHashes,
        status:
          'No matching joint hashes in this source skeleton at the audited source-frame times; no glTF motion synthesized.',
      });
  }
}
const base = `.cache/${slug}-current-converted`;
await mkdir(base, { recursive: true });
await rm(`${base}/animations`, { recursive: true, force: true });
await mkdir(`${base}/animations`);
const clips = [];
for (const [state, source] of Object.entries(pin.atomicClips)) {
  if (unboundSourceAnimations.some((clip) => clip.state === state)) continue;
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
  if (oracle || definition?.techniques?.[0]?.passes?.[0]?.blendEnable)
    material.setAlphaMode('BLEND');
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
  if (epic) {
    const source = bindingAudit.models
      .find((model) => model.name === champion)
      .clips.find((source) => source.state === clip.state);
    clip.sourceDurationSeconds = source.duration;
    clip.sourceFramesPerSecond = source.fps;
  }
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
await mkdir(outputDirectory, { recursive: true });
await writeFile(`${outputDirectory}/${slug}-base.glb`, bytes);
const manifest = {
  ...(companion ? { sourceSkinIndex: skinIndex } : {}),
  referenceVersion: pin.extraction.referenceVersion,
  status: epic
    ? 'Pinned base skin and every atomic entry with applicable rig channels. Unbound source entries are retained separately; native dispatch and rendering remain unverified.'
    : oracle
      ? 'Pinned skinned particle mesh and its single authored animation. No character skin or graph is implied; emitter transform, lifetime/material dispatch and native visual calibration remain separate.'
      : 'Pinned base skin mesh and all atomic clips; animation graph transitions, events, locomotion selection and reference lighting/pose calibration remain unfinished.',
  ...(oracle
    ? { sourceEmitter: oracleEmitter, sourceSystem: 'Items/3364/Particles/3364_Buff' }
    : {}),
  output: { path: `${outputUrl}/${slug}-base.glb`, bytes: bytes.length, sha256: hash(bytes) },
  definitionsSha256: hash(pinBytes),
  ...(epic ? { bindingAuditSha256: hash(bindingBytes), unboundSourceAnimations } : {}),
  sourceManifest: pin.extraction.manifest,
  sourceArchive: pin.extraction.archive,
  sources: pin.extraction.files,
  unitScale,
  canonicalizedJointSlots,
  skinScale: skin.skinScale ?? 1,
  skinScalePolicy: oracle
    ? 'Local geometry uses 0.01 unit conversion only. Authored particle birthScale, curves and offset are retained in sourceEmitter, not baked into geometry.'
    : 'Omitted source scale uses identity; native scale calibration remains open.',
  initialSubmeshesToHide: hidden,
  materialTextures: Object.fromEntries(materials.map((name) => [name, diffuse(name)])),
  materialPolicy: oracle
    ? 'Source diffuse assignment with unlit alpha preview shading. Original particle blendMode=3 is retained in sourceEmitter; this preview does not implement the native particle shader.'
    : 'Source diffuse assignment with unlit preview shading and authored blend flags. Reflection/gloss, dynamic ultimate materials, rig pose modifiers and native shading remain unfinished. Hidden submeshes retained with defaultHidden material metadata.',
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
await writeFile(`${outputDirectory}/${slug}-base.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    bytes: bytes.length,
    triangles: manifest.triangles,
    bones: manifest.bones,
    clips: clips.map((c) => [c.name, c.durationSeconds]),
  })
);
