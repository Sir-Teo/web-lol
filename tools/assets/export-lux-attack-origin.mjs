/** Extract R_Hand in the pinned attack GLB; independently verify an adaptive
 * position curve against the original hierarchical Three.js animation sampler.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
const clipName = process.argv[2] ?? 'attack1';
assert(['attack1', 'attack2'].includes(clipName), 'Unsupported clip');
const suffix = clipName === 'attack1' ? '' : '-2';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const glbPath = 'public/assets/models/lux-base.glb';
const bytes = await readFile(glbPath),
  manifest = JSON.parse(await readFile('public/assets/models/lux-base.json'));
assert.equal(hash(bytes), manifest.output.sha256);
assert.equal(bytes.length, manifest.output.bytes);
const characterBytes = await readFile('docs/reference/lux-character.json');
const variantsBytes = await readFile('docs/reference/lux-attack-variants.json');
const spellName = clipName === 'attack1' ? 'LuxBasicAttack' : 'LuxBasicAttack2';
const spell = JSON.parse(variantsBytes).records[`Characters/Lux/Spells/${spellName}`].mSpell;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(glbPath);
const nodes = doc.getRoot().listNodes();
const bone = nodes.find(
  (n) =>
    n.getName().toLowerCase() === spell.mMissileSpec.movementComponent.mStartBoneName.toLowerCase()
);
assert(bone, 'Missing source start bone');
const chain = [];
for (let n = bone; n; n = n.getParentNode()) chain.unshift(n);
const scene = new THREE.Group(),
  objects = new Map();
for (const n of chain) {
  const object = new THREE.Object3D();
  object.position.fromArray(n.getTranslation());
  object.quaternion.fromArray(n.getRotation());
  object.scale.fromArray(n.getScale());
  objects.set(n, object);
  (objects.get(n.getParentNode()) ?? scene).add(object);
}
const animation = doc
  .getRoot()
  .listAnimations()
  .find((a) => a.getName() === clipName);
assert(animation);
const duration = Math.max(
  ...animation.listSamplers().map((s) => Math.max(...s.getInput().getArray()))
);
const knots = new Set([0, duration]),
  tracks = [];
for (const channel of animation.listChannels()) {
  const object = objects.get(channel.getTargetNode());
  if (!object) continue;
  const sampler = channel.getSampler();
  assert.equal(sampler.getInterpolation(), 'LINEAR');
  const times = sampler.getInput().getArray(),
    values = sampler.getOutput().getArray();
  for (const time of times) knots.add(time);
  const path = channel.getTargetPath();
  assert(['translation', 'rotation', 'scale'].includes(path));
  tracks.push(
    path === 'rotation'
      ? new THREE.QuaternionKeyframeTrack(`${object.uuid}.quaternion`, times, values)
      : new THREE.VectorKeyframeTrack(
          `${object.uuid}.${path === 'translation' ? 'position' : 'scale'}`,
          times,
          values
        )
  );
}
const mixer = new THREE.AnimationMixer(scene);
const action = mixer.clipAction(new THREE.AnimationClip(clipName, duration, tracks));
action.setLoop(THREE.LoopOnce, 1);
action.clampWhenFinished = true;
action.play();
action.paused = true;
const target = objects.get(bone),
  point = new THREE.Vector3(),
  cache = new Map();
const sample = (time) => {
  if (!cache.has(time)) {
    action.time = time;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    target.getWorldPosition(point);
    cache.set(time, point.toArray());
  }
  return cache.get(time);
};
const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const error = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const tolerance = 1e-5,
  samples = [];
function refine(a, b, depth = 0) {
  const pa = sample(a),
    pb = sample(b);
  const worst = Math.max(
    ...[0.25, 0.5, 0.75].map((t) => error(sample(a + (b - a) * t), interpolate(pa, pb, t)))
  );
  if (worst > tolerance / 2) {
    assert(depth < 14, 'Refinement exhausted');
    const m = (a + b) / 2;
    refine(a, m, depth + 1);
    refine(m, b, depth + 1);
  } else samples.push({ time: a, position: pa });
}
const times = [...knots].sort((a, b) => a - b);
for (let i = 1; i < times.length; i++) if (times[i] > times[i - 1]) refine(times[i - 1], times[i]);
samples.push({ time: duration, position: sample(duration) });
let segment = 0,
  maxError = 0;
for (let i = 0; i <= 8000; i++) {
  const t = (duration * i) / 8000;
  while (segment + 1 < samples.length - 1 && samples[segment + 1].time < t) segment++;
  const a = samples[segment],
    b = samples[segment + 1];
  maxError = Math.max(
    maxError,
    error(sample(t), interpolate(a.position, b.position, (t - a.time) / (b.time - a.time)))
  );
}
assert(maxError <= tolerance, `Position curve exceeds error budget: ${maxError}`);
const output = {
  clip: clipName,
  bone: bone.getName(),
  duration,
  times: samples.map((p) => p.time),
  positions: samples.map((p) => p.position),
};
const outPath = `src/content/lux-attack-origin${suffix}.json`;
await writeFile(outPath, JSON.stringify(output) + '\n');
const provenance = {
  source: {
    glbPath,
    sha256: hash(bytes),
    characterSha256: hash(characterBytes),
    variantsSha256: hash(variantsBytes),
    modelManifestSha256: hash(await readFile('public/assets/models/lux-base.json')),
  },
  attachment: {
    movement: spell.mMissileSpec.movementComponent,
    verticalFacing: spell.mMissileSpec.verticalFacing,
    hitBone: spell.mHitBoneName,
    hitEffect: spell.mHitEffectKey,
  },
  chain: chain.map((n) => n.getName()),
  clip: clipName,
  duration,
  units: 'world units, same converted skeleton as gameplay',
  sampleCount: samples.length,
  verification: {
    denseSamples: 8001,
    maxErrorWorldUnits: maxError,
    toleranceWorldUnits: tolerance,
  },
  output: {
    path: outPath,
    sha256: hash(await readFile(outPath)),
    bytes: (await readFile(outPath)).length,
  },
  limitations: [
    `${clipName} animation only; game attack-cycle timing is not native timing certification`,
    'No animation transition blending',
    'Flight height/target augmentation semantics not inferred from field names',
  ],
};
await writeFile(
  `docs/reference/lux-attack-origin${suffix}.json`,
  JSON.stringify(provenance, null, 2) + '\n'
);
console.log(JSON.stringify(provenance));
