import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { ParticleSurfaceBatcher } from '../src/render/particle-surface-batch';
import { createLeonaEclipseSurfaceMaterial } from '../src/render/leona-eclipse-surface-material';
import { createParticleColorProductMaterial } from '../src/render/particle-color-product';

function createFixture() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  camera.position.set(0, 12, 18);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const quad = new THREE.PlaneGeometry(2, 2);
  const texture = new THREE.Texture();
  const lookup = new THREE.Texture();
  const batcher = new ParticleSurfaceBatcher(scene);

  function addEclipse(x = 0, z = 0, blendDst: THREE.BlendingDstFactor = THREE.OneFactor) {
    const material = createLeonaEclipseSurfaceMaterial({
      kind: 'quad',
      texture,
      lookup,
      erosion: { texture, mixer: [1, 0, 0, 0], featherIn: 0.2, featherOut: 0.3, sliceWidth: 0.5 },
    });
    Object.assign(material, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst,
      forceSinglePass: true,
    });
    const mesh = new THREE.Mesh(quad, material);
    mesh.frustumCulled = false;
    mesh.position.set(x, 0.2, z);
    scene.add(mesh);
    return mesh;
  }

  function addColorProduct(x = 0, z = 0) {
    const material = createParticleColorProductMaterial(texture, lookup);
    material.uniforms.sourceUvScale = { value: new THREE.Vector2(1.5, 0.5) };
    material.vertexShader = material.vertexShader
      .replace(
        'uniform vec2 sourceUvOffset;',
        'uniform vec2 sourceUvOffset;\nuniform vec2 sourceUvScale;'
      )
      .replace(
        'sourceUv = uv + sourceUvOffset;',
        'sourceUv = uv * sourceUvScale + sourceUvOffset;'
      );
    Object.assign(material, {
      transparent: true,
      depthWrite: false,
      depthTest: true,
      forceSinglePass: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(quad, material);
    mesh.frustumCulled = false;
    mesh.position.set(x, 0.2, z);
    scene.add(mesh);
    return mesh;
  }

  return { scene, camera, quad, texture, lookup, batcher, addEclipse, addColorProduct };
}

test('culls off-screen unculled particles, batches on-screen profiles, and restores scene state', () => {
  const f = createFixture();
  const nearA = f.addEclipse(-1, 0);
  const nearB = f.addEclipse(1, -0.5);
  const offscreen = f.addEclipse(500, 500);
  nearB.material.uniforms.particleColor.value.set(0.3, 0.5, 0.7, 0.9);
  nearB.material.uniforms.lookupUv.value.set(0.25, 0.75);
  nearB.material.uniforms.erosionParameters.value.x = 0.42;

  f.batcher.prepare(f.camera, false);
  expect(offscreen.visible).toBe(false);
  expect(nearA.visible).toBe(false);
  expect(nearB.visible).toBe(false);
  const batches = f.scene.children.filter(
    (c) => (c as THREE.Mesh).geometry instanceof THREE.InstancedBufferGeometry && c.visible
  ) as THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>[];
  expect(batches).toHaveLength(1);
  expect(batches[0].geometry.instanceCount).toBe(2);

  f.batcher.restore();
  expect(offscreen.visible).toBe(true);
  expect(nearA.visible).toBe(true);
  expect(nearB.visible).toBe(true);
  expect(batches[0].visible).toBe(false);
  expect(batches[0].geometry.instanceCount).toBe(0);
});

test('non-additive alpha draws split additive segments without reordering across barriers, and growing capacity preserves the compiled material', () => {
  const f = createFixture();
  const backAddA = f.addColorProduct(-0.5, -4);
  const backAddB = f.addColorProduct(0.5, -3.5);
  const alphaBarrier = f.addEclipse(0, -1, THREE.OneMinusSrcAlphaFactor);
  const frontAddA = f.addColorProduct(-0.5, 2);
  const frontAddB = f.addColorProduct(0.5, 2.5);

  f.batcher.prepare(f.camera, false);
  expect(alphaBarrier.visible).toBe(true);
  expect([backAddA, backAddB, frontAddA, frontAddB].every((m) => !m.visible)).toBe(true);
  const active = f.scene.children.filter(
    (c) => (c as THREE.Mesh).geometry instanceof THREE.InstancedBufferGeometry && c.visible
  ) as THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>[];
  expect(active).toHaveLength(2);
  expect(active.map((b) => b.geometry.instanceCount)).toEqual([2, 2]);

  const materialDispose = vi.fn();
  active[0].material.addEventListener('dispose', materialDispose);
  f.batcher.restore();

  for (let i = 0; i < 70; i++) f.addColorProduct((i % 7) * 0.2 - 0.6, -4 - i * 0.01);
  f.batcher.prepare(f.camera, false);
  expect(materialDispose).not.toHaveBeenCalled();

  const textureDispose = vi.fn();
  f.texture.addEventListener('dispose', textureDispose);
  f.batcher.dispose();
  expect(materialDispose).toHaveBeenCalledTimes(1);
  expect(textureDispose).not.toHaveBeenCalled();
});
