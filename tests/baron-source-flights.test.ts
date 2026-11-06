import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const factory = vi.hoisted(() => vi.fn());
vi.mock('../src/render/models', () => ({ createTargetPoseSampler: factory }));
import { BaronSourceFlights } from '../src/render/baron-source-flights';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import type { BaronParticleResources } from '../src/render/baron-particle-resources';
let capsule: THREE.BufferGeometry;
beforeAll(async () => {
  const bytes = Uint8Array.from(
      readFileSync('public/assets/effects/baron-attack/2a79d5c0e7f2dc6f.glb')
    ),
    gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  gltf.scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      capsule = node.geometry;
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        material.dispose();
    }
  });
});
afterAll(() => capsule.dispose());
const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
function fixture() {
  const samplers: TargetPoseSampler[] = [];
  factory.mockImplementation(() => {
    const root = new THREE.Group(),
      bone = new THREE.Bone();
    root.scale.setScalar(0.01);
    bone.name = BARON.basicAttack.startBone;
    bone.position.set(10, 300, 20);
    root.add(bone);
    const sampler = new TargetPoseSampler(
      root,
      Object.entries(MOBILE_CLIP_DURATIONS['sru-baron-base']).map(
        ([name, duration]) => new THREE.AnimationClip(name, duration, [])
      )
    );
    vi.spyOn(sampler, 'dispose');
    samplers.push(sampler);
    return sampler;
  });
  const program = JSON.parse(
      readFileSync('public/assets/effects/baron-attack/program.json', 'utf8')
    ),
    texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    geometry = capsule.clone(),
    dispose = vi.fn(() => geometry.dispose());
  const resources: BaronParticleResources = {
    program,
    textures: new Map(
      program.textures.map((r: { source: { wadPathHash: string } }) => [
        r.source.wadPathHash,
        texture,
      ])
    ),
    meshes: new Map([['2a79d5c0e7f2dc6f', geometry]]),
    dispose,
  };
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 8, 12);
  camera.lookAt(0, 0, 0);
  const flights = new BaronSourceFlights(scene, () => 0, resources),
    w = createBaronEncounter(field),
    boss = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, boss, 1, 'true');
  w.step();
  w.step(boss.releaseTick! - w.tick);
  const id = w.baronAttackVisuals[0].id;
  w.step(8);
  return { flights, w, boss, id, camera, dispose, samplers };
}
function reading(flights: BaronSourceFlights, id: number) {
  return flights.clouds.get(id)!.batch.root.children.map((child) => {
    const mesh = child as THREE.InstancedMesh,
      count = mesh.instanceMatrix ? mesh.count : mesh.geometry.drawRange.count;
    return {
      name: mesh.name,
      count,
      positions: mesh.instanceMatrix
        ? Array.from(mesh.instanceMatrix.array.slice(0, count * 16))
        : Array.from(mesh.geometry.getAttribute('position').array.slice(0, count * 3)),
      tint: Array.from(mesh.geometry.getAttribute('sourceTint').array.slice(0, count * 4)),
    };
  });
}
test('all nine source profiles reconstruct from saved roots without gameplay mutation', () => {
  const f = fixture(),
    saved = f.w.snapshot();
  f.flights.update(f.w, 1, f.camera);
  expect(f.w.snapshot()).toBe(saved);
  const cloud = f.flights.clouds.get(f.id)!,
    expected = reading(f.flights, f.id);
  expect(expected).toHaveLength(9);
  expect(expected.some((r) => r.count > 0)).toBe(true);
  expect(f.samplers).toHaveLength(1);
  expect(f.samplers[0].dispose).toHaveBeenCalledTimes(1);
  const copy = World.fromSnapshot(saved, f.w.battlefield);
  f.flights.update(copy, 1, f.camera);
  expect(reading(f.flights, f.id)).toEqual(expected);
  expect(cloud.batch.root.children).toHaveLength(0);
  expect(f.dispose).not.toHaveBeenCalled();
  f.flights.dispose();
  f.flights.dispose();
  expect(f.dispose).toHaveBeenCalledTimes(1);
});
test('target loss freezes the root and tail expiry retires instance buffers', () => {
  const f = fixture();
  f.flights.update(f.w, 1, f.camera);
  const cloud = f.flights.clouds.get(f.id)!;
  f.w.damage(f.boss, f.w.hero, f.w.hero.hp + 1, 'true');
  f.w.step();
  f.flights.update(f.w, 1, f.camera);
  expect(cloud.effect.stopReason).toBe('target-lost');
  const stopped = cloud.projection.sample(f.w.tick);
  f.w.step(5);
  f.flights.update(f.w, 1, f.camera);
  expect(cloud.projection.sample(f.w.tick)).toEqual(stopped);
  f.w.step(90);
  f.flights.update(f.w, 1, f.camera);
  expect(f.flights.clouds.has(f.id)).toBe(false);
  expect(cloud.batch.root.parent).toBeNull();
  expect(cloud.batch.root.children).toHaveLength(0);
  f.flights.dispose();
});
test('fractional draws and World replacement do not retain earlier clouds', () => {
  const f = fixture();
  f.flights.update(f.w, 0.5, f.camera);
  f.flights.update(f.w, 1, f.camera);
  const cloud = f.flights.clouds.get(f.id)!;
  f.flights.update(createBaronEncounter(field), 1, f.camera);
  expect(f.flights.clouds.size).toBe(0);
  expect(cloud.batch.root.parent).toBeNull();
  f.flights.dispose();
});
