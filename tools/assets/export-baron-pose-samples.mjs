/** Pinned real-rig poses sampled directly by Three, independently of the app sampler. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { poseOnlyGlb } from '../../tests/helpers/pose-only-glb.ts';
assert(
  process.argv.slice(2).every((arg) => arg === '--check'),
  'Unknown pose fixture argument'
);
const source = 'public/assets/models/sru-baron-base.glb',
  raw = fs.readFileSync(source),
  sha256 = createHash('sha256').update(raw).digest('hex');
assert.equal(sha256, '5d9cd6632d191270a94d976e284458145f9fa9e445165eaadb304e2892fff417');
const loaded = await new GLTFLoader().parseAsync(poseOnlyGlb(raw), ''),
  root = loaded.scene,
  mixer = new THREE.AnimationMixer(root),
  samples = [];
const specs = [
  ['idle1', 'entry_6c2b2ee6', 0],
  ['idle1', 'entry_6c2b2ee6', 1.9],
  ['attack1', 'entry_5ab94841', 0],
  ['attack1', 'entry_5ab94841', 0.28299999237060547],
  ['attack1', 'entry_5ab94841', 0.5],
  ['attack1', 'entry_5ab94841', 1.5],
];
for (const [alias, name, time] of specs) {
  mixer.stopAllAction();
  const clip = loaded.animations.find((c) => c.name === name);
  assert(clip);
  const action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1).play();
  action.clampWhenFinished = true;
  action.time = time;
  action.paused = true;
  mixer.update(0);
  root.updateMatrixWorld(true);
  const points = {};
  for (const name of [
    'Root',
    'Spine1',
    'Spine5',
    'Spine10',
    'Spine11',
    'Head1',
    'Head2',
    'JawBot',
  ]) {
    const bone = root.getObjectByName(name);
    assert(bone, name);
    points[name] = bone.getWorldPosition(new THREE.Vector3()).toArray();
  }
  samples.push({
    alias,
    clip: name,
    time,
    points,
    jawFromHead: points.JawBot.map((v, i) => v - points.Head1[i]),
  });
}
const result = {
  format: 1,
  source,
  sourceSha256: sha256,
  poseTransportHelperSha256: createHash('sha256')
    .update(fs.readFileSync('tests/helpers/pose-only-glb.ts'))
    .digest('hex'),
  nativeExecuted: false,
  scope:
    'Three direct source-clip pose, not native animation graph/dispatch. Geometry/skin/animation binary remains unchanged; image bindings omitted for Node.',
  samples,
};
const text = JSON.stringify(result, null, 2) + '\n',
  file = 'docs/reference/baron-real-rig-pose-samples.json';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), text);
else fs.writeFileSync(file, text, { flag: 'wx' });
console.log(
  JSON.stringify({ status: 'passed', poses: samples.length, joints: 8, nativeExecuted: false })
);
