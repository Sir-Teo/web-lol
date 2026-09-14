import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  profiles = {},
  sources = [];
for (const rig of ['blue', 'red'].flatMap((team) =>
  ['turret', 'inhibitor', 'nexus'].map((kind) => `${team}-${kind}`)
)) {
  const path = `public/assets/models/${rig}.glb`,
    bytes = await readFile(path);
  const meta = JSON.parse(await readFile(path.replace('.glb', '.json')));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, meta.output.sha256);
  assert.equal(bytes.length, meta.output.bytes);
  const doc = await io.read(path),
    extras = doc.getRoot().getDefaultScene().getExtras(),
    durations = {};
  for (const clip of doc.getRoot().listAnimations()) {
    assert(!Object.hasOwn(durations, clip.getName()));
    const time = Math.max(
      0,
      ...clip.listSamplers().map((s) =>
        s
          .getInput()
          .getArray()
          .reduce((max, v) => Math.max(max, v), 0)
      )
    );
    assert(Number.isFinite(time));
    durations[clip.getName()] = time;
  }
  assert.equal(typeof extras.destroyedClip, 'string');
  assert(Object.hasOwn(durations, 'idle1'));
  assert(Object.hasOwn(durations, extras.destroyedClip));
  if (extras.deadIdleClip !== undefined) {
    assert.equal(typeof extras.deadIdleClip, 'string');
    assert(Object.hasOwn(durations, extras.deadIdleClip));
  }
  assert(extras.animateDestruction === undefined || typeof extras.animateDestruction === 'boolean');
  profiles[rig] = {
    destroyedClip: extras.destroyedClip,
    animateDestruction: extras.animateDestruction ?? false,
    deadIdleClip: extras.deadIdleClip ?? null,
    durations,
  };
  sources.push({ path, sha256, bytes: bytes.length });
}
await writeFile(
  'src/content/structure-animation-profiles.json',
  JSON.stringify(profiles, null, 2) + '\n'
);
await writeFile(
  'docs/reference/structure-animation-profiles.json',
  JSON.stringify({ sources, profiles }, null, 2) + '\n'
);
console.log('Exported clip durations and adapter metadata for six verified structure rigs');
