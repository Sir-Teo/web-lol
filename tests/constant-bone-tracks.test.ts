import * as THREE from 'three';
import { expect, test } from 'vitest';
import { removeConstantBoneTracks } from '../src/render/constant-bone-tracks';

function fixture() {
  const root = new THREE.Group(),
    bone = new THREE.Bone();
  bone.name = 'joint';
  root.add(bone);
  const fixed = () => new THREE.VectorKeyframeTrack('joint.scale', [0, 1], [1, 1, 1, 1, 1, 1]);
  const dynamic = new THREE.VectorKeyframeTrack('joint.position', [0, 1], [0, 0, 0, 3, 2, 1]);
  const clips = [
    new THREE.AnimationClip('idle', 2, [fixed()]),
    new THREE.AnimationClip('move', 1, [fixed(), dynamic]),
  ];
  return { root, bone, clips };
}

test('only invariant rest channels are removed, retaining names, durations and original clips', () => {
  const { root, clips } = fixture();
  const result = removeConstantBoneTracks(root, clips);
  expect(result.map((c) => [c.name, c.duration, c.tracks.length])).toEqual([
    ['idle', 2, 0],
    ['move', 1, 1],
  ]);
  expect(clips.map((c) => c.tracks.length)).toEqual([1, 2]);
  const a = root.clone(),
    b = root.clone();
  const original = new THREE.AnimationMixer(a),
    optimized = new THREE.AnimationMixer(b);
  original.clipAction(clips[1]).play();
  optimized.clipAction(result[1]).play();
  for (let i = 0; i < 50; i++) {
    original.update(0.013);
    optimized.update(0.013);
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);
    expect(b.children[0].matrixWorld.elements).toEqual(a.children[0].matrixWorld.elements);
  }
});

test('one changing clip or a different rest value retains every channel for that property', () => {
  for (const mode of ['other-clip', 'rest'] as const) {
    const { root, bone, clips } = fixture();
    if (mode === 'other-clip') clips[1].tracks[0].values[3] = 2;
    else bone.scale.x = 2;
    expect(removeConstantBoneTracks(root, clips).map((c) => c.tracks.length)).toEqual([1, 2]);
  }
});

test('additive, indexed and smooth interpolation inputs are not silently simplified', () => {
  for (const mode of ['additive', 'indexed', 'smooth'] as const) {
    const { root, clips } = fixture();
    if (mode === 'additive') clips[0].blendMode = THREE.AdditiveAnimationBlendMode;
    if (mode === 'indexed') clips[0].tracks[0].name = 'joint.scale[x]';
    if (mode === 'smooth') clips[1].tracks[0].setInterpolation(THREE.InterpolateSmooth);
    expect(removeConstantBoneTracks(root, clips).map((c) => c.tracks.length)).toEqual([1, 2]);
  }
});
