import { expect, test } from 'vitest';
import * as THREE from 'three';
import { BaronLaunchAttachment } from '../src/render/baron-launch-attachment';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';

function pose() {
  const w = createBaronEncounter({ ...PRACTICE_FIXTURE, developmentBaron: true });
  const b = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, b, 1, 'true');
  w.step();
  w.step(b.releaseTick! - w.tick);
  return structuredClone(w.baronAttackVisuals[0].launchPose);
}
function fixture(name = 'JawBot') {
  const root = new THREE.Group(),
    bone = new THREE.Bone();
  root.position.set(0.5, 0, 0);
  bone.name = name;
  bone.position.set(1, 2, 3);
  root.add(bone);
  const clip = new THREE.AnimationClip('attack1', 2, [
    new THREE.VectorKeyframeTrack(`${name}.position`, [0, 2], [1, 2, 3, 5, 2, 3]),
  ]);
  return { root, bone, sampler: new TargetPoseSampler(root, [clip]) };
}

test('places the historical joint with authored root, saved facing and terrain exactly once', () => {
  const { sampler, bone } = fixture();
  const attachment = new BaronLaunchAttachment(sampler, (p) => p.x * 0.001);
  const p = pose();
  p.x = 100;
  p.y = 200;
  p.facing = Math.PI / 2;
  p.animationTimeline!.primary.time = 0.5;
  p.animationTimeline!.primary.unclampedTime = 0.5;
  const point = new THREE.Vector3().setFromMatrixPosition(attachment.matrix(p));
  expect(point.x).toBeCloseTo(4, 12);
  expect(point.y).toBeCloseTo(2.1, 12);
  expect(point.z).toBeCloseTo(-0.5, 12);
  expect(bone.position.toArray()).toEqual([1, 2, 3]);
  attachment.matrix(p).elements.fill(999);
  expect(new THREE.Vector3().setFromMatrixPosition(attachment.matrix(p))).toEqual(point);
  const restored = structuredClone(p);
  restored.animationTimeline!.primary.time = 1;
  restored.animationTimeline!.primary.unclampedTime = 1;
  expect(new THREE.Vector3().setFromMatrixPosition(attachment.matrix(restored)).z).toBeCloseTo(
    -1.5,
    12
  );
  expect(new THREE.Vector3().setFromMatrixPosition(attachment.matrix(p))).toEqual(point);
  attachment.dispose();
  attachment.dispose();
  expect(() => attachment.matrix(p)).toThrow('disposed');
});

test('rejects absent authored joints, invalid terrain and edited pose clocks', () => {
  const missing = new BaronLaunchAttachment(fixture('Other').sampler, () => 0);
  expect(() => missing.matrix(pose())).toThrow('authored launch joint');
  missing.dispose();
  const height = new BaronLaunchAttachment(fixture().sampler, () => NaN);
  expect(() => height.matrix(pose())).toThrow('terrain');
  height.dispose();
  const attachment = new BaronLaunchAttachment(fixture().sampler, () => 0);
  const invalid = pose();
  invalid.animationTimeline!.tick--;
  expect(() => attachment.matrix(invalid)).toThrow('release pose');
  attachment.dispose();
});

test('resolves the pinned native Baron attack clips and authored joint without texture decoding', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { monsterClipAliases } = await import('../src/render/monster-clip-aliases');
  const { BARON } = await import('../src/content/baron');
  const bytes = readFileSync('public/assets/models/sru-baron-base.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '5d9cd6632d191270a94d976e284458145f9fa9e445165eaadb304e2892fff417'
  );
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  const binary = bytes.subarray(binStart, binStart + bytes.readUInt32LE(binStart - 8));
  // Pose-only input: original buffer/accessors/skins/tracks stay byte-identical.
  // Materials and images are excluded so this check needs no DOM/image decoder.
  delete document.images;
  delete document.textures;
  delete document.materials;
  for (const mesh of document.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  const jsonBytes = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20);
  jsonBytes.copy(padded);
  const poseGlb = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  poseGlb.writeUInt32LE(0x46546c67, 0);
  poseGlb.writeUInt32LE(2, 4);
  poseGlb.writeUInt32LE(poseGlb.length, 8);
  poseGlb.writeUInt32LE(padded.length, 12);
  poseGlb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(poseGlb, 20);
  poseGlb.writeUInt32LE(binary.length, 20 + padded.length);
  poseGlb.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(poseGlb, 28 + padded.length);
  const gltf = await new GLTFLoader().parseAsync(
    poseGlb.buffer.slice(poseGlb.byteOffset, poseGlb.byteOffset + poseGlb.byteLength),
    ''
  );
  const clips = monsterClipAliases(gltf.animations, BARON.clips, BARON.rig);
  const sampler = new TargetPoseSampler(gltf.scene, clips);
  const attachment = new BaronLaunchAttachment(sampler, () => 0);
  const release = pose();
  const first = attachment.matrix(release);
  expect(first.elements.every(Number.isFinite)).toBe(true);
  const mouth = new THREE.Vector3().setFromMatrixPosition(first);
  expect(mouth.length()).toBeGreaterThan(0.1);
  expect(mouth.length()).toBeLessThan(30);
  const restored = structuredClone(release);
  expect(attachment.matrix(restored).elements).toEqual(first.elements);
  attachment.dispose();
});
