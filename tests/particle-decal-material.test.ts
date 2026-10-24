import { expect, test } from 'vitest';
import * as THREE from 'three';
import {
  createParticleDecalMaterial,
  type ParticleDecalBindings,
} from '../src/render/particle-decal-material';
function fixture() {
  const geometry = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 2, 0, 0, 0, 1], 3)
  );
  const diffuse = new THREE.Texture(),
    lookup = new THREE.Texture();
  const bindings: ParticleDecalBindings = {
    diffuse,
    lookup,
    world: new THREE.Matrix4(),
    worldToUv: new THREE.Matrix4(),
    heightRange: [0, 500, 500],
    color: [1, 1, 1, 1],
    lookupUv: [0.5, 0.5],
  };
  return { geometry, diffuse, lookup, bindings };
}
test('decal copies explicit matrix/vector bindings while borrowing receiving geometry and images', () => {
  const f = fixture(),
    before = f.geometry.toJSON(),
    material = createParticleDecalMaterial(f.geometry, f.bindings);
  f.bindings.world.makeTranslation(1, 2, 3);
  expect(material.uniforms.decalWorld.value.elements).toEqual(new THREE.Matrix4().elements);
  expect(material.uniforms.diffuseTexture.value).toBe(f.diffuse);
  expect(material.uniforms.particleColorTexture.value).toBe(f.lookup);
  let borrowed = 0;
  for (const r of [f.geometry, f.diffuse, f.lookup])
    r.addEventListener('dispose', () => borrowed++);
  material.dispose();
  expect(borrowed).toBe(0);
  expect(f.geometry.toJSON()).toEqual(before);
  expect(material.uniforms).not.toHaveProperty('remapTexture');
  expect(material.blending).toBe(THREE.NoBlending);
  expect(material.toneMapped).toBe(false);
  f.geometry.dispose();
  f.diffuse.dispose();
  f.lookup.dispose();
});
test('missing/non-finite receiving triangles or bindings and undefined fade distance fail explicitly', () => {
  const f = fixture();
  expect(() => createParticleDecalMaterial(new THREE.BufferGeometry(), f.bindings)).toThrow(
    'receiving'
  );
  f.geometry.getAttribute('position').setX(1, NaN);
  expect(() => createParticleDecalMaterial(f.geometry, f.bindings)).toThrow('position');
  f.geometry.getAttribute('position').setX(1, 1);
  f.geometry.setIndex([0, 1, 3]);
  expect(() => createParticleDecalMaterial(f.geometry, f.bindings)).toThrow('index');
  f.geometry.setIndex([0, 1]);
  expect(() => createParticleDecalMaterial(f.geometry, f.bindings)).toThrow('complete');
  f.geometry.setIndex(null);
  expect(() =>
    createParticleDecalMaterial(f.geometry, { ...f.bindings, heightRange: [0, 1, 0] })
  ).toThrow('positive');
  expect(() =>
    createParticleDecalMaterial(f.geometry, { ...f.bindings, color: [1, Infinity, 1, 1] })
  ).toThrow('Non-finite');
  f.geometry.dispose();
  f.diffuse.dispose();
  f.lookup.dispose();
});
test('fog and palette streams remain explicit independent optional bindings', () => {
  const f = fixture(),
    fog = new THREE.Texture(),
    palette = new THREE.Texture();
  const material = createParticleDecalMaterial(f.geometry, {
    ...f.bindings,
    fog: { texture: fog, transform: [0.1, 0.2, 0.3, 0.4] },
    palette: {
      texture: palette,
      sourceMix: [0.299, 0.587, 0.114, 0],
      row: 9.5 / 16,
      scroll: [0.1, 0.2],
    },
  });
  expect(material.defines).toEqual({ SOURCE_FOW: 1, SOURCE_PALETTE: 1 });
  expect(material.uniforms.fogTexture.value).toBe(fog);
  expect(material.uniforms.paletteRow.value).toBe(9.5 / 16);
  expect(material.uniforms.heightRange.value.toArray()).toEqual([0, 500, 500]);
  material.dispose();
  for (const r of [f.geometry, f.diffuse, f.lookup, fog, palette]) r.dispose();
});
