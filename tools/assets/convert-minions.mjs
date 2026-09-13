/** Convert matching patch 16.18 base minions to compact, animated GLB assets. */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const supers = process.argv.includes('--super');
const family = supers ? 'super-minion' : 'minion';
const sourceRoot = `.cache/${family}-sources`;
const converted = `.cache/${family}-converted`;
const root = `${sourceRoot}/assets/characters`;
const provenance = JSON.parse(await readFile(`${sourceRoot}/provenance.json`, 'utf8'));
const definitionsPath = supers
  ? 'docs/reference/super-minion-definitions.json'
  : 'docs/reference/minion-skins.json';
const definitionBytes = await readFile(definitionsPath);
if (supers && hash(definitionBytes) !== provenance.definitionsSha256)
  throw new Error('Super-minion definitions differ from pinned provenance');
for (const source of provenance.files) {
  const bytes = await readFile(`${sourceRoot}/${source.path}`);
  if (hash(bytes) !== source.sha256 || bytes.length !== source.bytes)
    throw new Error(`Extracted source differs from recorded provenance: ${source.path}`);
}
const skinDefinitions = JSON.parse(definitionBytes);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const definitions = supers
  ? [
      [
        'blue',
        'super',
        'sru_orderminionsuper',
        'blue_minion_superminion',
        'blue_superminion_tx_cm',
      ],
      ['red', 'super', 'sru_chaosminionsuper', 'red_minion_superminion', 'red_superminion_tx_cm'],
    ]
  : [
      ['blue', 'melee', 'sru_orderminionmelee', 'order_minion_melee', 'orderminion_melee_tx_cm'],
      ['red', 'melee', 'sru_chaosminionmelee', 'chaos_minion_melee', 'chaosminion_melee_tx_cm'],
      [
        'blue',
        'caster',
        'sru_orderminionranged',
        'order_minion_caster',
        'orderminion_caster_tx_cm',
      ],
      ['red', 'caster', 'sru_chaosminionranged', 'chaos_minion_caster', 'red_caster_tx_cm'],
      ['blue', 'siege', 'sru_orderminionsiege', 'order_minion_siege', 'order_minion_siege_tx_cm'],
      ['red', 'siege', 'sru_chaosminionsiege', 'chaos_minion_siege', 'chaos_minion_siege_tx_cm'],
    ];
await mkdir(converted, { recursive: true });
await mkdir('public/assets/models', { recursive: true });
for (const [team, kind, character, mesh, texture] of definitions) {
  const name = `${team}-${kind}`;
  const base = `${root}/${character}/skins/base`;
  const metadata = skinDefinitions[character];
  const skin = Object.values(metadata.skins.data)[0].skinMeshProperties;
  const graph = Object.values(metadata.animations.data)[0].mClipDataMap;
  const clips = [];
  const animationsPath = `${converted}/${name}-animations`;
  await rm(animationsPath, { recursive: true, force: true });
  await mkdir(animationsPath, { recursive: true });
  for (const [canonical, state] of Object.entries({
    idle1: 'Idle1',
    run: 'Run',
    attack1: 'Attack1',
    death: 'Death',
    ...(supers ? { attack2: 'Attack2', death2: '{bd31845b}' } : {}),
  })) {
    let entry = graph[state];
    if (entry.mSelectorPairDataList) entry = graph[entry.mSelectorPairDataList[0].mClipName];
    const source = entry.mAnimationResourceData.mAnimationFilePath.toLowerCase();
    await copyFile(`${sourceRoot}/${source}`, `${animationsPath}/${canonical}.anm`);
    clips.push({ name: canonical, source });
  }
  const rawPath = `${converted}/${name}.glb`;
  const meshBytes = await readFile(`${base}/${mesh}.skn`);
  const materialNames = Array.from(
    { length: meshBytes.readUInt32LE(8) },
    (_, i) =>
      meshBytes
        .subarray(12 + i * 80, 76 + i * 80)
        .toString('utf8')
        .split('\0')[0]
  );
  execFileSync(
    '.tools/dotnet/dotnet',
    [
      '.tools/converter/lol2gltf.dll',
      'skn2gltf',
      '-m',
      `${base}/${mesh}.skn`,
      '-s',
      `${base}/${mesh}.skl`,
      '-g',
      rawPath,
      '-a',
      animationsPath,
      '--materials',
      ...materialNames,
      '--textures',
      ...materialNames.map(() => `${base}/${texture}.tex`),
    ],
    { stdio: 'inherit' }
  );
  const doc = await io.read(rawPath);
  const asset = doc.getRoot().getAsset();
  asset.copyright = 'Minion artwork and animation © Riot Games. Reference content.';
  asset.generator = 'web-lol minion converter 0.1; lol2gltf + glTF Transform';

  // Bake centimeters into geometry, bind matrices, joints and translation tracks.
  // An outer scaled node would break the root placement of a skinned mesh.
  const unitScale = 0.01 * skin.skinScale;
  const scaled = new Set();
  const scale = (accessor, matrix = false) => {
    if (scaled.has(accessor)) return;
    scaled.add(accessor);
    const values = accessor.getArray();
    if (matrix) {
      for (let i = 0; i < values.length; i += 16)
        for (const j of [12, 13, 14]) values[i + j] *= unitScale;
    } else for (let i = 0; i < values.length; i++) values[i] *= unitScale;
    accessor.setArray(values);
  };
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) scale(p.getAttribute('POSITION'));
  for (const skin of doc.getRoot().listSkins()) scale(skin.getInverseBindMatrices(), true);
  for (const node of doc.getRoot().listNodes())
    node.setTranslation(node.getTranslation().map((v) => v * unitScale));
  for (const animation of doc.getRoot().listAnimations())
    for (const channel of animation.listChannels())
      if (channel.getTargetPath() === 'translation') scale(channel.getSampler().getOutput());

  await doc.transform(resample(), dedup(), prune());
  if (supers)
    for (const clip of clips) {
      const animation = doc
        .getRoot()
        .listAnimations()
        .find((a) => a.getName() === clip.name);
      clip.durationSeconds = Math.max(
        ...animation.listSamplers().map((s) => Math.max(...s.getInput().getArray()))
      );
    }
  const bytes = await io.writeBinary(doc);
  const path = `public/assets/models/${name}.glb`;
  await writeFile(path, bytes);
  const manifest = {
    referenceVersion: provenance.referenceVersion,
    status:
      'Matching patch 16.18 base minion sources. Reference presentation still requires gameplay capture calibration.',
    output: { path: `/assets/models/${name}.glb`, bytes: bytes.length, sha256: hash(bytes) },
    sourceManifest: provenance.manifest,
    sourceArchive: provenance.archive,
    sources: provenance.files.filter(
      (f) =>
        f.path === `assets/characters/${character}/skins/base/${mesh}.skn` ||
        f.path === `assets/characters/${character}/skins/base/${mesh}.skl` ||
        f.path === `assets/characters/${character}/skins/base/${texture}.tex` ||
        clips.some((c) => c.source === f.path)
    ),
    skinScale: skin.skinScale,
    definitionSources: { skin: metadata.skins.url, animations: metadata.animations.url },
    clips,
    triangles: doc
      .getRoot()
      .listMeshes()
      .reduce(
        (sum, m) => sum + m.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0),
        0
      ),
    bones: doc.getRoot().listSkins()[0].listJoints().length,
  };
  await writeFile(path.replace('.glb', '.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `${name}: ${(bytes.length / 1024).toFixed(0)} KiB, ${manifest.triangles} triangles, ${manifest.bones} joints`
  );
}
await writeFile(
  `docs/reference/${family}-extraction.json`,
  JSON.stringify(provenance, null, 2) + '\n'
);
