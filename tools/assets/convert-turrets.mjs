import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(await readFile('docs/reference/turret-extraction.json', 'utf8'));
for (const file of provenance.files)
  if (hash(await readFile('.cache/turret-sources/' + file.path)) !== file.sha256)
    throw new Error('Tower source changed: ' + file.path);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const definitionBytes = await readFile('docs/reference/turret-definitions.json');
if (hash(definitionBytes) !== provenance.definitionsSha256)
  throw new Error('Tower definitions changed');
const definitions = JSON.parse(definitionBytes);
for (const team of ['blue', 'red']) {
  const def = definitions[team],
    skin = Object.values(def.skin.data).find((v) => v.skinMeshProperties).skinMeshProperties;
  const base = '.cache/turret-sources/';
  const mesh = base + skin.simpleSkin.toLowerCase(),
    rig = base + skin.skeleton.toLowerCase();
  const bytes = await readFile(mesh),
    names = Array.from(
      { length: bytes.readUInt32LE(8) },
      (_, i) =>
        bytes
          .subarray(12 + i * 80, 76 + i * 80)
          .toString('utf8')
          .split('\0')[0]
    );
  const anim = '.cache/turret-converted/' + team + '-animations';
  await rm(anim, { recursive: true, force: true });
  await mkdir(anim, { recursive: true });
  const graph = Object.values(def.animation.data).find((v) => v.mClipDataMap).mClipDataMap;
  const paths = [
    ...new Set(
      Object.values(graph)
        .filter((v) => v.mAnimationResourceData)
        .map((v) => v.mAnimationResourceData.mAnimationFilePath.toLowerCase())
    ),
  ];
  for (const path of paths) await copyFile(base + path, anim + '/' + path.split('/').at(-1));
  console.log(team, names);
  execFileSync(
    '.tools/dotnet/dotnet',
    [
      '.tools/converter/lol2gltf.dll',
      'skn2gltf',
      '-m',
      mesh,
      '-s',
      rig,
      '-g',
      `.cache/turret-converted/${team}.glb`,
      '-a',
      anim,
      '--materials',
      ...names,
      '--textures',
      ...names.map(
        (name) =>
          base +
          (
            skin.materialOverride.find((v) => v.submesh === name)?.texture ?? skin.texture
          ).toLowerCase()
      ),
    ],
    { stdio: 'inherit' }
  );
  const doc = await io.read(`.cache/turret-converted/${team}.glb`);
  const scaleValue = 0.01 * (skin.skinScale ?? 1),
    scaled = new Set();
  const scale = (accessor, matrix = false) => {
    if (scaled.has(accessor)) return;
    scaled.add(accessor);
    const a = accessor.getArray();
    if (matrix) {
      for (let i = 0; i < a.length; i += 16) for (const j of [12, 13, 14]) a[i + j] *= scaleValue;
    } else for (let i = 0; i < a.length; i++) a[i] *= scaleValue;
    accessor.setArray(a);
  };
  for (const m of doc.getRoot().listMeshes())
    for (const primitive of m.listPrimitives()) scale(primitive.getAttribute('POSITION'));
  for (const rig of doc.getRoot().listSkins()) scale(rig.getInverseBindMatrices(), true);
  for (const n of doc.getRoot().listNodes())
    n.setTranslation(n.getTranslation().map((v) => v * scaleValue));
  for (const a of doc.getRoot().listAnimations())
    for (const c of a.listChannels())
      if (c.getTargetPath() === 'translation') scale(c.getSampler().getOutput());
  // Independent nodes preserve source submesh visibility without duplicating buffers.
  const hidden = skin.initialSubmeshToHide.split(/\s+/);
  const destroyed = new Set(names.filter((name) => !hidden.includes(name)));
  for (const event of Object.values(graph.Destroyed.mEventDataMap)) {
    for (const name of event.mHideSubmeshList ?? []) destroyed.delete(name);
    for (const name of event.mShowSubmeshList ?? []) destroyed.add(name);
  }
  doc
    .getRoot()
    .getDefaultScene()
    .setExtras({
      destroyedClip: graph.Destroyed.mAnimationResourceData.mAnimationFilePath
        .split('/')
        .at(-1)
        .replace('.anm', ''),
    });
  for (const n of doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh())) {
    const m = n.getMesh(),
      rig = n.getSkin();
    for (const p of m.listPrimitives()) {
      const name = p.getMaterial().getName();
      const part = doc
        .createNode(name)
        .setMesh(doc.createMesh(name).addPrimitive(p))
        .setSkin(rig)
        .setExtras({
          submesh: name,
          initiallyHidden: hidden.includes(name),
          destroyedVisible: destroyed.has(name),
        });
      doc.getRoot().getDefaultScene().addChild(part);
    }
    n.setMesh(null).setSkin(null);
    m.dispose();
  }
  const asset = doc.getRoot().getAsset();
  asset.copyright = 'Tower artwork and animation © Riot Games. Reference content.';
  asset.generator = 'web-lol tower converter 0.1; lol2gltf + glTF Transform';
  await doc.transform(resample(), dedup(), prune());
  const output = await io.writeBinary(doc),
    name = `${team}-turret`;
  await writeFile(`public/assets/models/${name}.glb`, output);
  const clips = doc
    .getRoot()
    .listAnimations()
    .map((a) => ({
      name: a.getName(),
      source: paths.find((p) => p.endsWith('/' + a.getName() + '.anm')),
    }));
  const submeshes = doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh())
    .map((n) => ({
      name: n.getName(),
      initiallyHidden: n.getExtras().initiallyHidden,
      triangles: n
        .getMesh()
        .listPrimitives()
        .reduce((s, p) => s + p.getIndices().getCount() / 3, 0),
    }));
  const manifest = {
    referenceVersion: provenance.referenceVersion,
    status:
      'Matching source model, scale, parts and clips. Particle effects and full graph sequencing remain incomplete.',
    output: { path: `/assets/models/${name}.glb`, bytes: output.length, sha256: hash(output) },
    sourceManifest: provenance.manifest,
    sourceArchive: provenance.archive,
    sources: provenance.files.filter(
      (f) =>
        f.path === skin.simpleSkin.toLowerCase() ||
        f.path === skin.skeleton.toLowerCase() ||
        f.path === skin.texture ||
        skin.materialOverride.some((o) => o.texture === f.path) ||
        paths.includes(f.path)
    ),
    definitionSources: { skin: def.skin.url, animation: def.animation.url },
    skinScale: skin.skinScale ?? 1,
    clips,
    submeshes,
    triangles: submeshes.reduce((s, p) => s + p.triangles, 0),
    bones: doc.getRoot().listSkins()[0].listJoints().length,
  };
  await writeFile(`public/assets/models/${name}.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(name, output.length, manifest.triangles, manifest.bones);
}
