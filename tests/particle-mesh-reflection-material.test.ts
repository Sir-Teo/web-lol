import { expect, test } from 'vitest';
import * as THREE from 'three';
import { createParticleMeshReflectionMaterial } from '../src/render/particle-mesh-reflection-material';

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
