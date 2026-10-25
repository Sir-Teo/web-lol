/** Rebuild the development Master Yi rig from pinned source bytes into a fresh directory. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const argument = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const root = argument('--source-root'),
  base = argument('--output-root');
assert(root && base, 'Provide --source-root and a new --output-root');
const champion = 'MasterYi',
  slug = 'masteryi';
const pinBytes = await readFile('docs/reference/masteryi-model.json');
assert.equal(hash(pinBytes), '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce');
const pin = JSON.parse(pinBytes);
assert.equal(pin.extraction.referenceVersion, '16.18.8175716');
assert.equal(pin.extraction.files.length, 29);
assert.equal(Object.keys(pin.atomicClips).length, 47);
for (const [file, expected] of [
  [
    '.tools/converter/lol2gltf.dll',
    'bd230c0f8f168a64c2afeb5c038b07fafc99412e06e9cf2d441c666f7d135df0',
  ],
  [
    '.tools/converter/LeagueToolkit.dll',
    'fcf44e3094da754854ce6497cef8bcf9536e3cbde00ef2cc597efeb95db3b290',
  ],
  [
    '.tools/lol2gltf/src/lol2gltf/Program.cs',
    '9cdfc2b8ca5058e22af3387af21da36649f4fd83828ae187b876372dcf6a0916',
  ],
])
  assert.equal(hash(await readFile(file)), expected, file);
for (const f of pin.extraction.files) {
  const b = await readFile(`${root}/${f.path}`);
  if (b.length !== f.bytes || hash(b) !== f.sha256)
    throw new Error(`${champion} source differs: ${f.path}`);
}
const skin = pin.skin.data['Characters/MasterYi/Skins/Skin0'].skinMeshProperties;
assert.equal(skin.skinScale, 1.5);
// Fail on an existing output before invoking the converter or touching its files.
await mkdir(base);
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
  const override = skin.materialOverride?.find((o) => o.submesh === name);
  if (override?.texture) return override.texture.toLowerCase();
  if (override?.Material) {
    const definition = pin.skin.data[override.Material],
      sampler = definition?.samplerValues?.find((s) => s.TextureName === 'Diffuse_Texture');
    if (!sampler) throw Error(`Missing diffuse sampler for ${name}`);
    return sampler.texturePath.toLowerCase();
  }
  return skin.texture.toLowerCase();
}
const hidden = (skin.initialSubmeshToHide ?? '').split(' ').filter(Boolean);
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
    defaultHidden: hidden.some((entry) => entry === name),
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
const sourceQuaternionCorrections = [];
for (const animation of doc.getRoot().listAnimations())
  for (const channel of animation.listChannels()) {
    if (channel.getTargetPath() !== 'rotation') continue;
    const accessor = channel.getSampler().getOutput(),
      values = accessor.getArray();
    for (let i = 0; i < values.length; i += 4) {
      const raw = Array.from(values.slice(i, i + 4)),
        length = Math.hypot(...raw);
      if (Math.abs(length - 1) <= 1e-4) continue;
      if (
        champion !== 'MasterYi' ||
        animation.getName() !== 'spell3' ||
        channel.getTargetNode().getName() !== 'C_Buffbone_Glb_Center_Loc' ||
        JSON.stringify(raw) !== '[0,0.8457037210464478,0,0]' ||
        length <= 0
      )
        throw new Error('Unexpected non-unit rotation; preserve and investigate.');
      const normalized = raw.map((value) => value / length);
      sourceQuaternionCorrections.push({
        clip: animation.getName(),
        bone: channel.getTargetNode().getName(),
        key: i / 4,
        raw,
        normalized,
        length,
      });
      values.set(normalized, i);
    }
    accessor.setArray(values);
  }
if (sourceQuaternionCorrections.length !== 26)
  throw new Error('Expected exactly 26 retained source corrections.');
await writeFile(
  `${base}/quaternion-corrections.json`,
  JSON.stringify(
    {
      policy:
        'Research candidate: normalize exactly the 26 nonzero source rotation keys to preserve their orientation direction in valid glTF. Raw keys remain retained. Native magnitude semantics and visual acceptance are unresolved.',
      nativeCalibrated: false,
      sourceQuaternionCorrections,
    },
    null,
    2
  ) + '\n'
);

await doc.transform(dedup(), prune({ keepAttributes: true }));
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
assert.equal(
  hash(bytes),
  '7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc',
  'Rebuilt asset differs from the reviewed development candidate'
);
await writeFile(`${base}/masteryi-base.glb`, bytes, { flag: 'wx' });
const manifest = {
  sourceQuaternionCorrections,
  animationKeyPolicy:
    'All converted source keys retained; no resampling or key simplification applied.',
  quaternionPolicy:
    'Exactly 26 literal non-unit source Spell3/center-bone keys are normalized for valid glTF. Original values remain retained; native magnitude handling is unverified.',
  referenceVersion: pin.extraction.referenceVersion,
  status:
    'Development rig preparation only. Native appearance, animation graph, events, attachments and playable kit remain unfinished.',
  output: {
    path: 'public/assets/models/masteryi-base.glb',
    bytes: bytes.length,
    sha256: hash(bytes),
  },
  definitionsSha256: hash(pinBytes),
  rawConversion: { bytes: (await readFile(raw)).length, sha256: hash(await readFile(raw)) },
  sourceManifest: pin.extraction.manifest,
  sourceArchive: pin.extraction.archive,
  sources: pin.extraction.files,
  unitScale,
  canonicalizedJointSlots,
  skinScale: skin.skinScale,
  skinScalePolicy:
    'Authored skinScale 1.5 is baked with the local 0.01 conversion; native scale calibration remains open.',
  initialSubmeshesToHide: hidden,
  materialTextures: Object.fromEntries(materials.map((name) => [name, diffuse(name)])),
  materialPolicy:
    'Source diffuse with unlit development shading. Native self-illumination, reflection/gloss, rig modifiers and dynamic materials remain unfinished.',
  clips,
  triangles: doc
    .getRoot()
    .listMeshes()
    .reduce(
      (n, m) => n + m.listPrimitives().reduce((v, p) => v + p.getIndices().getCount() / 3, 0),
      0
    ),
  bones: doc.getRoot().listSkins()[0].listJoints().length,
  acceptance: {
    developmentRigPrepared: true,
    nativeEquivalent: false,
    playableKit: false,
    productionRosterExpanded: false,
  },
};
assert.equal(manifest.triangles, 9144);
assert.equal(manifest.bones, 90);
assert.equal(canonicalizedJointSlots, 13475);
await writeFile(`${base}/masteryi-base.json`, JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    result: 'passed',
    outputRoot: base,
    sha256: hash(bytes),
    triangles: manifest.triangles,
    bones: manifest.bones,
    clips: clips.length,
    corrections: sourceQuaternionCorrections.length,
  })
);
