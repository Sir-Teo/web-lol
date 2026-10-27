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
test('instances encode the exact float32 model-view, UV, color and lookup values', () => {
  const f = fixture(),
    a = f.add(),
    b = f.add();
  b.material.uniforms.particleColor.value.set(0.2, 0.4, 0.6, 0.8);
  b.material.uniforms.lookupUv.value.set(0.17, 0.91);
  b.material.uniforms.sourceUvTransform.value.set(2, 0, 0.3, 0, 0.5, 0.8, 0, 0, 1);
  b.material.uniforms.multiplierUvTransform.value.set(1, 0, -0.2, 0, 0.5, 0.6, 0, 0, 1);
  f.prepare();
  const batch = f.batches.batches.get(0)!;
  expect(batch.mesh.geometry.instanceCount).toBe(2);
  expect(a.visible).toBe(false);
  expect(b.visible).toBe(false);
  const sorted = batch.mesh.userData.sourceIds.map((id: number) =>
    f.surfaces.find((s) => s.id === id)!
  );
  for (const [i, surface] of (sorted as typeof f.surfaces).entries()) {
    const expected = new Float32Array(
      new THREE.Matrix4().multiplyMatrices(f.camera.matrixWorldInverse, surface.matrixWorld)
        .elements
    );
    expect(
      batch.mesh.geometry.getAttribute('instanceModelView').array.slice(i * 16, (i + 1) * 16)
    ).toEqual(expected);
    for (const [name, size] of [
      ['sourceUvTransform', 9],
      ['multiplierUvTransform', 9],
      ['particleColor', 4],
      ['lookupUv', 2],
    ] as const) {
      const value = surface.material.uniforms[name].value;
      expect(batch.mesh.geometry.getAttribute(name).array.slice(i * size, (i + 1) * size)).toEqual(
        new Float32Array(value.elements ?? value.toArray())
      );
    }
  }
  expect(batch.mesh.material.uniforms.sourceSampler0.value).toBe(f.texture);
  expect(batch.mesh.material.uniforms.particleColor).toBeUndefined();
  expect(batch.mesh.material.uniforms.alphaRef.value).toBe(5 / 255);
});
test('capacity grows once, batches combine equal profiles, and shrinking clears stale instances', () => {
  const f = fixture();
  f.add();
  f.prepare();
  const old = f.batches.batches.get(0)!;
  const dispose = vi.spyOn(old.mesh.geometry, 'dispose');
  f.add();
  f.add();
  f.add(5);
  f.prepare();
  expect(dispose).toHaveBeenCalledOnce();
  expect(old.mesh.parent).toBeNull();
  const current = f.batches.batches.get(0)!;
  expect(current.capacity).toBe(4);
  expect(current.mesh.geometry.instanceCount).toBe(4);
  f.surfaces.splice(1);
  f.prepare();
  expect(f.batches.batches.get(0)).toBe(current);
  expect(current.mesh.geometry.instanceCount).toBe(1);

  f.surfaces.length = 0;
  f.prepare();
  expect(current.mesh.visible).toBe(false);
});
test('a changed camera requires prepare and refreshes the CPU model-view data', () => {
  const f = fixture();
  f.add();
  f.prepare();
  const batch = f.batches.batches.get(0)!;
  const before = Array.from(batch.mesh.geometry.getAttribute('instanceModelView').array);
  f.camera.position.x += 4;
  f.camera.updateMatrixWorld();
  const draw = () =>
    batch.mesh.onBeforeRender(
      null!,
      f.scene,
      f.camera,
      batch.mesh.geometry,
      batch.mesh.material,
      null!
    );
  expect(draw).toThrow('Prepare particle instances');
  f.prepare();
  expect(draw).not.toThrow();
  expect(Array.from(batch.mesh.geometry.getAttribute('instanceModelView').array)).not.toEqual(
    before
  );
});
test('disposal owns batches and preserves borrowed source textures, geometry and materials', () => {
  const f = fixture(),
    surface = f.add();
  f.prepare();
  const batch = f.batches.batches.get(0)!;
  const texture = vi.spyOn(f.texture, 'dispose'),
    geometry = vi.spyOn(surface.geometry, 'dispose'),
    material = vi.spyOn(surface.material, 'dispose');
  const batchGeometry = vi.spyOn(batch.mesh.geometry, 'dispose'),
    batchMaterial = vi.spyOn(batch.mesh.material, 'dispose');
  f.batches.dispose();
  f.batches.dispose();
  expect(batchGeometry).toHaveBeenCalledOnce();
  expect(batchMaterial).toHaveBeenCalledOnce();
  expect(batch.mesh.parent).toBeNull();
  expect(texture).not.toHaveBeenCalled();
  expect(geometry).not.toHaveBeenCalled();
  expect(material).not.toHaveBeenCalled();
});
test('unsupported alpha blending and source mesh defines fail closed', () => {
  const f = fixture(),
    surface = f.add();
  surface.material.blendDst = THREE.OneMinusSrcAlphaFactor;
  expect(f.prepare).toThrow('additive source quads');
  surface.material.blendDst = THREE.OneFactor;
  surface.material.defines.SOURCE_MESH = 1;
  expect(f.prepare).toThrow('additive source quads');
});

test('an interleaved transparent draw retains original surfaces and resumes batching after removal', () => {
  const f = fixture();
  const a = f.add(),
    b = f.add();
  b.position.z += 1;
  f.prepare();
  const batch = f.batches.batches.get(0)!;
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  blocker.position.copy(a.position);
  f.scene.add(blocker);
  f.prepare();
  expect(batch.mesh.visible).toBe(false);
  expect(batch.mesh.geometry.instanceCount).toBe(0);
  expect(a.visible).toBe(true);
  expect(b.visible).toBe(true);
  blocker.removeFromParent();
  f.prepare();
  expect(batch.mesh.visible).toBe(true);
  expect(a.visible).toBe(false);
});

test('new texture slots replace the batch once and verified texture objects remain borrowed', () => {
  const f = fixture();
  f.add();
  f.add();
  f.add();
  f.prepare();
  const old = f.batches.batches.get(0)!,
    dispose = vi.spyOn(old.mesh.material, 'dispose');
  const extra = new THREE.Texture();
  f.surfaces[1].material.uniforms.sourceTexture.value = extra;
  f.prepare();
  const current = f.batches.batches.get(0)!;
  expect(dispose).toHaveBeenCalledOnce();
  expect(current.capacity).toBe(4);
  expect(current.textures).toContain(extra);
  expect(current.textures).toContain(f.texture);
  expect(Object.values(current.mesh.material.uniforms).map((u) => u.value)).toContain(extra);
  f.prepare();
  expect(f.batches.batches.get(0)).toBe(current);
});

test('draws outside the depth interval or in another render phase preserve batching', () => {
  const f = fixture();
  const a = f.add();
  f.add();
  const blocker = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true })
  );
  blocker.position.copy(a.position);
  blocker.renderOrder = 10;
  f.scene.add(blocker);
  f.prepare();
  expect(f.batches.batches.get(0)!.mesh.visible).toBe(true);
  blocker.renderOrder = 0;
  blocker.position.z += 100;
  f.prepare();
  expect(f.batches.batches.get(0)!.mesh.visible).toBe(true);
  expect(f.batches.batches.get(0)!.mesh.userData.sourceIds).toHaveLength(2);
});
