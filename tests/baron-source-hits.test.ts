import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const factory = vi.hoisted(() => vi.fn());
vi.mock('../src/render/models', () => ({ createTargetPoseSampler: factory }));
import { BaronSourceHits } from '../src/render/baron-source-hits';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import type { BaronParticleResources } from '../src/render/baron-particle-resources';
const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
function fixture() {
  factory.mockImplementation(() => {
    const root = new THREE.Group(),
      bone = new THREE.Bone();
    root.scale.setScalar(0.01);
    bone.name = BARON.basicAttack.hitBone;
    bone.position.set(10, 100, 30);
    root.add(bone);
    return new TargetPoseSampler(
      root,
      Object.entries(MOBILE_CLIP_DURATIONS['ashe-base']).map(
        ([name, duration]) => new THREE.AnimationClip(name, duration, [])
      )
    );
  });
  const program = JSON.parse(
    readFileSync('public/assets/effects/baron-attack/program.json', 'utf8')
  );
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    dispose = vi.fn();
  const resources: BaronParticleResources = {
    program,
    textures: new Map(
      program.textures.map((r: { source: { wadPathHash: string } }) => [
        r.source.wadPathHash,
        texture,
      ])
    ),
    meshes: new Map(),
    dispose,
  };
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 8, 12);
  camera.lookAt(0, 0, 0);
  const hits = new BaronSourceHits(scene, () => 0, resources),
    w = createBaronEncounter(field),
    boss = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, boss, 1, 'true');
  w.step();
  w.step(boss.releaseTick! - w.tick);
  for (let i = 0; i < 90 && !w.baronAttackVisuals[0].impact; i++) w.step();
  const id = w.baronAttackVisuals.find((v) => v.impact)!.id;
  w.step(8);
  return { hits, w, boss, id, scene, camera, dispose };
}
function reading(hits: BaronSourceHits, id: number) {
  return hits.clouds.get(id)!.batch.root.children.map((child) => {
    const mesh = child as THREE.InstancedMesh;
    return {
      name: mesh.name,
      count: mesh.count,
      matrix: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
      tint: Array.from(mesh.geometry.getAttribute('sourceTint').array.slice(0, mesh.count * 4)),
    };
  });
}
test('historical chest hits render without mutating gameplay and rebuild after World replacement', () => {
  const f = fixture(),
    saved = f.w.snapshot();
  f.hits.update(f.w, 1, f.camera);
  expect(f.w.snapshot()).toBe(saved);
  expect(f.hits.clouds.has(f.id)).toBe(true);
  const cloud = f.hits.clouds.get(f.id)!,
    expected = reading(f.hits, f.id);
  expect(expected).toHaveLength(12);
  for (const index of [2, 4]) {
    const material = (cloud.batch.root.children[index] as THREE.Mesh)
      .material as THREE.ShaderMaterial;
    expect([
      material.polygonOffset,
      material.polygonOffsetFactor,
      material.polygonOffsetUnits,
    ]).toEqual([true, -1, -1]);
  }
  expect(expected.some((r) => r.count > 0)).toBe(true);
  const copy = World.fromSnapshot(saved, f.w.battlefield);
  f.hits.update(copy, 1, f.camera);
  expect(reading(f.hits, f.id)).toEqual(expected);
  expect(cloud.batch.root.parent).toBeNull();
  expect(cloud.batch.root.children).toHaveLength(0);
  expect(() => cloud.attachment.matrix(cloud.contact, cloud.contact.startTick)).toThrow('disposed');
  expect(f.dispose).not.toHaveBeenCalled();
  f.hits.dispose();
  f.hits.dispose();
  expect(f.dispose).toHaveBeenCalledTimes(1);
});
test('target death freezes the saved chest and expired effects retire private resources', () => {
  const f = fixture();
  f.hits.update(f.w, 1, f.camera);
  const cloud = f.hits.clouds.get(f.id)!;
  f.w.damage(f.boss, f.w.hero, f.w.hero.hp + 1, 'true');
  f.w.step();
  f.hits.update(f.w, 1, f.camera);
  const detached = cloud.contact.detachedTick!;
  expect(detached).toBe(f.w.tick);
  const matrix = cloud.attachment.matrix(cloud.contact, detached);
  f.w.step(8);
  f.hits.update(f.w, 1, f.camera);
  expect(cloud.attachment.matrix(cloud.contact, f.w.tick).elements).toEqual(matrix.elements);
  f.w.step(130);
  f.hits.update(f.w, 1, f.camera);
  expect(f.hits.clouds.has(f.id)).toBe(false);
  expect(cloud.batch.root.children).toHaveLength(0);
  expect(f.dispose).not.toHaveBeenCalled();
  f.hits.dispose();
});
test('empty replacement Worlds remove earlier clouds instead of reusing an old pose', () => {
  const f = fixture();
  f.hits.update(f.w, 1, f.camera);
  expect(f.hits.clouds.size).toBeGreaterThan(0);
  const fresh = createBaronEncounter(field);
  f.hits.update(fresh, 1, f.camera);
  expect(f.hits.clouds.size).toBe(0);
  expect(f.scene.children).toHaveLength(0);
  f.hits.dispose();
});
