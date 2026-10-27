import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { SwordParticleInstances } from '../src/render/masteryi-sword-instances';
import { createLeonaEclipseSurfaceMaterial } from '../src/render/leona-eclipse-surface-material';
function fixture() {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(),
    texture = new THREE.Texture();
  camera.position.set(1, 2, 3);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const surfaces: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  function add(profile = 2) {
    const material = createLeonaEclipseSurfaceMaterial({
      kind: 'quad',
      texture,
      lookup: texture,
      multiplier: texture,
      lockAlpha: true,
    });
    Object.assign(material, {
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });
    material.uniforms.alphaRef.value = 5 / 255;
    const geometry = new THREE.PlaneGeometry(2, 2),
      uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      uv.setXY(i, v, 1 - u);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0.1 * surfaces.length, 0.2, 0.3);
    mesh.rotation.set(0.4, 0.2, 0.1);
    mesh.scale.set(-0.5, 0.7, 1);
    mesh.userData.profileIndex = profile;
    scene.add(mesh);
    surfaces.push(mesh);
    return mesh;
  }
  const batches = new SwordParticleInstances(scene);
  return {
    scene,
    camera,
    texture,
    surfaces,
    add,
    batches,
    prepare: () => batches.prepare(surfaces, camera),
  };
}
test('strict transparent gaps split ordered contiguous source segments', () => {
  const f = fixture();
  f.camera.position.set(0, 0, 10);
  f.camera.lookAt(0, 0, 0);
  f.camera.updateMatrixWorld();
  for (const z of [-3, -1, 1, 3]) f.add().position.set(0, 0, z);
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  blocker.position.z = 0;
  f.scene.add(blocker);
  f.prepare();
  const visible = [...f.batches.batches.values()].filter((b) => b.mesh.visible);
  expect(visible).toHaveLength(2);
  expect(visible.flatMap((b) => b.mesh.userData.sourceIds)).toEqual(f.surfaces.map((s) => s.id));
  expect(visible.map((b) => b.mesh.geometry.instanceCount)).toEqual([2, 2]);
  expect(f.surfaces.every((s) => !s.visible)).toBe(true);
});

test('multiple interleavers in one gap create no empty or duplicate segments', () => {
  const f = fixture();
  f.camera.position.set(0, 0, 10);
  f.camera.lookAt(0, 0, 0);
  f.camera.updateMatrixWorld();
  for (const z of [-3, -1, 1, 3]) f.add().position.set(0, 0, z);
  for (const z of [-2, -0.5, 0.5, 2]) {
    const blocker = new THREE.Mesh(
      new THREE.PlaneGeometry(),
      new THREE.MeshBasicMaterial({ transparent: true })
    );
    blocker.position.z = z;
    f.scene.add(blocker);
  }
  f.prepare();
  const visible = [...f.batches.batches.values()].filter((b) => b.mesh.visible);
  expect(visible).toHaveLength(4);
  expect(visible.map((b) => b.mesh.geometry.instanceCount)).toEqual([1, 1, 1, 1]);
  expect(visible.flatMap((b) => b.mesh.userData.sourceIds)).toEqual(f.surfaces.map((s) => s.id));
});

test('removed interleavers merge groups while old segments become inactive', () => {
  const f = fixture();
  f.camera.position.set(0, 0, 10);
  f.camera.lookAt(0, 0, 0);
  f.camera.updateMatrixWorld();
  f.add().position.set(0, 0, -1);
  f.add().position.set(0, 0, 1);
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  f.scene.add(blocker);
  f.prepare();
  const second = f.batches.batches.get(1)!;
  expect(second.mesh.visible).toBe(true);
  blocker.removeFromParent();
  f.prepare();
  expect(f.batches.batches.get(0)!.mesh.geometry.instanceCount).toBe(2);
  expect(second.mesh.visible).toBe(false);
  expect(second.mesh.geometry.instanceCount).toBe(0);
});

test('ambiguous sprite bounds preserve the original source draws', () => {
  const f = fixture();
  f.add();
  f.add();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  f.scene.add(sprite);
  f.prepare();
  expect(f.surfaces.every((s) => s.visible)).toBe(true);
  expect([...f.batches.batches.values()].every((b) => !b.mesh.visible)).toBe(true);
});

test('every segment preserves the same borrowed sampler table and owns only its buffers/material', () => {
  const f = fixture();
  f.camera.position.set(0, 0, 10);
  f.camera.lookAt(0, 0, 0);
  f.camera.updateMatrixWorld();
  const a = f.add(),
    b = f.add(),
    other = new THREE.Texture();
  a.position.set(0, 0, -1);
  b.position.set(0, 0, 1);
  b.material.uniforms.sourceTexture.value = other;
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  f.scene.add(blocker);
  f.prepare();
  const segments = [...f.batches.batches.values()].filter((batch) => batch.mesh.visible);
  expect(segments).toHaveLength(2);
  for (const segment of segments) expect(segment.textures).toEqual([f.texture, other]);
  const owned = segments.map((batch) => [
    vi.spyOn(batch.mesh.geometry, 'dispose'),
    vi.spyOn(batch.mesh.material, 'dispose'),
  ]);
  const borrowed = [
    vi.spyOn(f.texture, 'dispose'),
    vi.spyOn(other, 'dispose'),
    vi.spyOn(a.geometry, 'dispose'),
    vi.spyOn(a.material, 'dispose'),
  ];
  f.batches.dispose();
  f.batches.dispose();
  for (const group of owned) for (const dispose of group) expect(dispose).toHaveBeenCalledOnce();
  for (const dispose of borrowed) expect(dispose).not.toHaveBeenCalled();
});

test('a depth tie after a split hides every segment and restores all original surfaces', () => {
  const f = fixture();
  f.camera.position.set(0, 0, 10);
  f.camera.lookAt(0, 0, 0);
  f.camera.updateMatrixWorld();
  const a = f.add(),
    b = f.add();
  a.position.set(0, 0, -1);
  b.position.set(0, 0, 1);
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  f.scene.add(blocker);
  f.prepare();
  expect([...f.batches.batches.values()].filter((batch) => batch.mesh.visible)).toHaveLength(2);
  blocker.position.copy(a.position);
  f.prepare();
  expect(
    [...f.batches.batches.values()].every(
      (batch) => !batch.mesh.visible && batch.mesh.geometry.instanceCount === 0
    )
  ).toBe(true);
  expect(f.surfaces.every((surface) => surface.visible)).toBe(true);
});

test('object-owned instanced bounds keep the conservative individual-draw path', () => {
  const f = fixture();
  f.add();
  f.add();
  const external = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true }),
    1
  );
  f.scene.add(external);
  f.prepare();
  expect(f.surfaces.every((surface) => surface.visible)).toBe(true);
  expect([...f.batches.batches.values()].every((batch) => !batch.mesh.visible)).toBe(true);
});
