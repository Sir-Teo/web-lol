import { expect, test } from 'vitest';
import * as THREE from 'three';
import {
  createParticleMeshReflectionMaterial,
  createParticleMeshRimMaterial,
} from '../src/render/particle-mesh-reflection-material';
import { renderParticleColorPhase } from '../src/render/particle-color-phase';
import type { ParticleDistortionPass } from '../src/render/particle-distortion-pass';

function bindings() {
  return {
    texture: new THREE.Texture(),
    lookup: new THREE.Texture(),
    remap: new THREE.Texture(),
    environment: new THREE.CubeTexture(),
    uvTransform: new THREE.Matrix3(),
    lookupUv: [0.5, 0.5] as const,
    tint: [1, 1, 1, 1] as const,
    reflection: [1, 0, 1] as const,
    reflectionColor: [1, 1, 1] as const,
    fresnel: [1, 0.4, 0.03, 0.15] as const,
    depthPushPull: 0,
  };
}

test('missing, mismatched, zero and nonfinite normals fail without generating mesh attributes', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const before = g.attributes.position.array.slice();
  expect(() => createParticleMeshReflectionMaterial(g, bindings())).toThrow('normal stream');
  expect(g.getAttribute('normal')).toBeUndefined();
  for (const [values, size] of [
    [[0, 1, 0], 3],
    [[0, 1, 0, 1, 0, 1], 2],
    [[0, 0, 1, 0, 0, 0, 0, 0, 1], 3],
    [[0, 0, 1, 0, NaN, 1, 0, 0, 1], 3],
    [[0, 0, 1, 0, 0, 1, Infinity, 0, 1], 3],
  ] as const) {
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...values], size));
    expect(() => createParticleMeshReflectionMaterial(g, bindings())).toThrow(/normal/);
  }
  expect(g.attributes.position.array).toEqual(before);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array(3).fill([0, 0, 1]).flat(), 3));
  expect(() => createParticleMeshReflectionMaterial(g, bindings())).toThrow('UV streams');
});

test('material snapshots uniform values and borrows all textures and geometry', () => {
  const g = new THREE.PlaneGeometry(),
    b = bindings();
  let disposed = 0;
  for (const resource of [g, b.texture, b.lookup, b.remap, b.environment])
    resource.addEventListener('dispose', () => disposed++);
  const m = createParticleMeshReflectionMaterial(g, b);
  b.uvTransform.elements[0] = 42;
  expect(m.uniforms.sourceUvTransform.value.elements[0]).toBe(1);
  expect(m.uniforms.reflectionTexture.value).toBe(b.environment);
  expect(m.uniforms.sourceTexture.value).toBe(b.texture);
  expect(m.uniforms.particleColorTexture.value).toBe(b.lookup);
  expect(m.uniforms.remapTexture.value).toBe(b.remap);
  expect(m.blending).toBe(THREE.NoBlending);
  m.dispose();
  expect(disposed).toBe(0);
});

test('nonfinite bindings and nonpositive powers fail before allocating a material', () => {
  const g = new THREE.PlaneGeometry();
  for (const extra of [
    { depthPushPull: Infinity },
    { reflection: [NaN, 0, 1] as const },
    { reflection: [0, 0, 1] as const },
    { fresnel: [1, 1, 1, -1] as const },
    { reflectionColor: [1, NaN, 1] as const },
    { uvTransform: new THREE.Matrix3().set(NaN, 0, 0, 0, 1, 0, 0, 0, 1) },
  ])
    expect(() => createParticleMeshReflectionMaterial(g, { ...bindings(), ...extra })).toThrow(
      RangeError
    );
});

test('rim-only material borrows three textures and needs no cube or reflection fields', () => {
  const { environment, reflection, reflectionColor, ...b } = bindings(),
    g = new THREE.PlaneGeometry();
  let disposed = 0;
  for (const resource of [g, b.texture, b.lookup, b.remap])
    resource.addEventListener('dispose', () => disposed++);
  const m = createParticleMeshRimMaterial(g, b);
  expect(m.uniforms.reflectionTexture).toBeUndefined();
  expect(m.uniforms.reflectionParameters).toBeUndefined();
  expect(m.uniforms.reflectionColor).toBeUndefined();
  expect(m.defines.SOURCE_REFLECTIVE).toBeUndefined();
  b.uvTransform.elements[0] = 42;
  expect(m.uniforms.sourceUvTransform.value.elements[0]).toBe(1);
  expect(m.uniforms.fresnel.value.toArray()).toEqual(b.fresnel);
  expect(m.uniforms.sourceTexture.value).toBe(b.texture);
  m.dispose();
  expect(disposed).toBe(0);
  expect(() => createParticleMeshRimMaterial(g, { ...b, fresnel: [1, 1, 1, 0] })).toThrow(
    RangeError
  );
  for (const alphaRef of [-1, 1.1, NaN])
    expect(() => createParticleMeshRimMaterial(g, { ...b, alphaRef })).toThrow(RangeError);
  g.deleteAttribute('normal');
  expect(() => createParticleMeshRimMaterial(g, b)).toThrow('normal stream');
});

test('ordinary mesh color is excluded from early backdrop capture and restored for the color pass', () => {
  const geometry = new THREE.PlaneGeometry(),
    b = bindings(),
    material = createParticleMeshRimMaterial(geometry, b),
    scene = new THREE.Scene(),
    phases: boolean[] = [];
  scene.add(new THREE.Mesh(geometry, material));
  const renderer = {
    autoClear: true,
    shadowMap: { autoUpdate: true },
    info: { autoReset: true },
    getRenderTarget: () => null,
    render: () => phases.push(material.visible),
  } as unknown as THREE.WebGLRenderer;
  const early = {
    hasDraws: () => true,
    render: () => phases.push(material.visible),
  } as unknown as ParticleDistortionPass;
  expect(renderParticleColorPhase(renderer, scene, new THREE.Camera(), early)).toBe(true);
  expect(phases).toEqual([false, false, true]);
  expect(material.visible).toBe(true);
  material.dispose();
  geometry.dispose();
});
