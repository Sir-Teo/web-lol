import { expect, test } from 'vitest';
import * as THREE from 'three';
import { createParticleSkinMultMaterial } from '../src/render/particle-skin-mult-material';

test('skin multiplier borrows both independent samplers and explicit remap without owning textures', () => {
  const texture = new THREE.Texture(),
    multiplier = new THREE.Texture(),
    remap = new THREE.Texture();
  let released = 0;
  for (const t of [texture, multiplier, remap]) t.addEventListener('dispose', () => released++);
  const material = createParticleSkinMultMaterial({
    texture,
    multiplier,
    remap,
    fresnel: 1,
    fresnelColor: [0, 0, 0],
    alphaRef: 5 / 255,
  });
  expect(material.uniforms.sourceTexture.value).toBe(texture);
  expect(material.uniforms.multiplierTexture.value).toBe(multiplier);
  expect(material.uniforms.remapTexture.value).toBe(remap);
  expect(material.uniforms.sourceUvTransform.value).not.toBe(
    material.uniforms.multiplierUvTransform.value
  );
  expect(material.uniforms.alphaRef.value).toBe(5 / 255);
  expect(material.defines).toEqual({ SOURCE_ALPHA_TEST: 1, SOURCE_REMAP: 1 });
  expect([material.depthWrite, material.side, material.blendSrc, material.blendDst]).toEqual([
    false,
    THREE.FrontSide,
    THREE.SrcAlphaFactor,
    THREE.OneFactor,
  ]);
  material.dispose();
  expect(released).toBe(0);
});

test('omitted alpha test and remap remain distinct from an explicit zero threshold', () => {
  const texture = new THREE.Texture(),
    options = { texture, multiplier: texture, fresnel: 1, fresnelColor: [0, 0, 0] as const },
    plain = createParticleSkinMultMaterial(options),
    tested = createParticleSkinMultMaterial({ ...options, alphaRef: 0 });
  expect(plain.defines).toEqual({});
  expect(plain.uniforms.alphaRef).toBeUndefined();
  expect(plain.uniforms.remapTexture).toBeUndefined();
  expect(tested.defines).toEqual({ SOURCE_ALPHA_TEST: 1 });
  expect(tested.uniforms.alphaRef.value).toBe(0);
  plain.dispose();
  tested.dispose();
  texture.dispose();
});

test('non-finite explicit skin parameters fail before material creation', () => {
  const texture = new THREE.Texture(),
    options = { texture, multiplier: texture, fresnel: 1, fresnelColor: [0, 0, 0] as const };
  for (const invalid of [
    { fresnel: NaN },
    { fresnel: -1 },
    { alphaRef: Infinity },
    { fresnelColor: [0, NaN, 0] as const },
  ])
    expect(() => createParticleSkinMultMaterial({ ...options, ...invalid })).toThrow(RangeError);
  texture.dispose();
});
