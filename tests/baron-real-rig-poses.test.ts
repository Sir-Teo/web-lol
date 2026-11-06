import { afterAll, beforeAll, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import samples from '../docs/reference/baron-real-rig-pose-samples.json';
import { poseOnlyGlb } from './helpers/pose-only-glb';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { monsterClipAliases } from '../src/render/monster-clip-aliases';
import { BARON } from '../src/content/baron';
let sampler: TargetPoseSampler, reference: THREE.Object3D, rest: number[][];
beforeAll(async () => {
  const raw = readFileSync(samples.source);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(samples.sourceSha256);
  const gltf = await new GLTFLoader().parseAsync(poseOnlyGlb(raw), '');
  reference = gltf.scene;
  reference.updateMatrixWorld(true);
  rest = reference.children.map((c) => c.matrixWorld.toArray());
  sampler = new TargetPoseSampler(
    reference,
    monsterClipAliases(gltf.animations, BARON.clips, BARON.rig)
  );
});
afterAll(() => {
  sampler.dispose();
  reference.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        material.dispose();
    }
  });
});
for (const sample of samples.samples)
  test(`real private rig matches direct source pose ${sample.alias} at ${sample.time}`, () => {
    sampler.sample([{ clip: sample.alias, time: sample.time, weight: 1 }]);
    for (const [name, expected] of Object.entries(sample.points)) {
      const point = new THREE.Vector3();
      expect(sampler.bonePosition(name, point)).toBe(true);
      point.toArray().forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 12));
    }
    expect(reference.children.map((c) => c.matrixWorld.toArray())).toEqual(rest);
    expect(sample.jawFromHead[2]).toBeGreaterThan(0.45);
  });
test('real Baron pose fixture regenerates without the application sampler', () => {
  execFileSync(process.execPath, ['tools/assets/export-baron-pose-samples.mjs', '--check'], {
    stdio: 'pipe',
  });
});
