import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import {
  createLeonaEclipseSkinMaterial,
  leonaEclipseSkinFresnel,
} from '../src/render/leona-eclipse-skin-material';
import descriptions from '../docs/reference/leona-w-skin-materials.json';

test('Eclipse maps the authored rim control through the checked native CPU input', () => {
  execFileSync('.tools/cdtb-venv/bin/python', [
    'tools/assets/export-leona-w-skin-fresnel.py',
    '--check',
  ]);
  expect(leonaEclipseSkinFresnel(4, Math.fround(0.05))).toBe(0.3449999988079071);
  expect(leonaEclipseSkinFresnel(9, Math.fround(0.05))).toBe(0.3449999988079071);
  expect(leonaEclipseSkinFresnel(5, Math.fround(0.15))).toBe(0.8350000381469727);
  expect(leonaEclipseSkinFresnel(6, Math.fround(0.15))).toBe(0.8350000381469727);
  for (const [profile, source] of [
    [4, 0.15],
    [5, NaN],
    [3, Math.fround(0.05)],
  ])
    expect(() => leonaEclipseSkinFresnel(profile, source)).toThrow(RangeError);
});

test('all four Eclipse source skin descriptions reproduce without local reader caches', () => {
  execFileSync('python3', ['tools/assets/export-leona-w-skin-materials.py', '--check']);
  expect(descriptions.profiles.map((p) => [p.system, p.index])).toEqual([
    ['Leona_W_buf_1', 4],
    ['Leona_W_buf_1', 5],
    ['Leona_W_buf_1', 6],
    ['Leona_W_buf_2', 2],
  ]);
  expect(descriptions.profiles.filter((p) => p.erosion)).toHaveLength(2);
});

test('skin materials retain source single-pass additive policy and dispose no borrowed textures', () => {
  const source = new THREE.Texture(),
    erosion = new THREE.Texture(),
    remap = new THREE.Texture();
  let released = 0;
  for (const t of [source, erosion, remap]) t.addEventListener('dispose', () => released++);
  const m = createLeonaEclipseSkinMaterial({
    texture: source,
    fresnel: 0.15,
    fresnelColor: [1, 0.7, 0.3],
    erosion: {
      texture: erosion,
      mixer: [0, 0, 0, 1],
      featherIn: 0.35,
      featherOut: 0.35,
      sliceWidth: 1.5,
    },
    remap,
  });
  expect([m.forceSinglePass, m.depthWrite, m.side, m.blendSrc, m.blendDst]).toEqual([
    true,
    false,
    THREE.DoubleSide,
    THREE.SrcAlphaFactor,
    THREE.OneFactor,
  ]);
  expect(m.uniforms.sourceTexture.value).toBe(source);
  expect(m.uniforms.erosionTexture.value).toBe(erosion);
  expect(m.uniforms.remapTexture.value).toBe(remap);
  m.dispose();
  expect(released).toBe(0);
});

test('invalid skin material inputs fail before GPU allocation', () => {
  const texture = new THREE.Texture();
  expect(() =>
    createLeonaEclipseSkinMaterial({ texture, fresnel: NaN, fresnelColor: [1, 1, 1] })
  ).toThrow(RangeError);
  expect(() =>
    createLeonaEclipseSkinMaterial({
      texture,
      fresnel: 0.05,
      fresnelColor: [1, 1, 1],
      erosion: { texture, mixer: [0, 0, 0, 1], featherIn: 0, featherOut: 0.1, sliceWidth: 1.5 },
    })
  ).toThrow(RangeError);
});
