import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import data from '../src/content/ahri-q-cast-particles.json';
import source from '../docs/reference/ahri/q-particles.json';
const hash = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
test('all three native cast emitters preserve finite lives, authored colors and explicit source fields', () => {
  const native = source.resources.Ahri_Q_Cas.definition.complexEmitterDefinitionData;
  expect(data.profiles.map((p) => p.kind)).toEqual(['billboard', 'mesh', 'skin']);
  for (let i = 0; i < 3; i++) {
    const p = data.profiles[i],
      e = native[i];
    expect(p.explicitFields).toEqual(Object.keys(e).sort());
    expect(p.life.values[0][0]).toBe(e.particleLifetime.constantValue);
    expect(p.birthColor.constant).toEqual(e.birthColor.constantValue);
    expect(p.single).toBe(true);
    expect(p.bind.values[0]).toEqual([1]);
  }
});
test('rotation, scroll/clamp, erosion and unmatched attached selectors cannot silently disappear', () => {
  const p = data.profiles[1],
    skin = data.profiles[2];
  expect(p.uv.rotationDegrees.values[0]).toEqual([180]);
  expect(p.uv.birthScroll.values[0]).toEqual([0, 3]);
  expect(p.uv.offset.values[0]).toEqual([0, -1]);
  expect(p.uv.scale.values[0]).toEqual([1, 2]);
  expect(p.uv.clamp).toBe(true);
  expect(p.uv.address).toBe(2);
  expect(skin.matchedSubmeshes).toEqual(['Tails']);
  expect(skin.unmatchedSubmeshSelectors).toEqual(['{62579b4c}']);
  expect(skin.erosion?.texture).toContain('ahri-q-cast-');
  expect(skin.reflection).toMatchObject({
    source: 0.15000000596046448,
    mappedPower: 0.8350000381469727,
  });
});
test('four public textures retain all twenty-eight authored mip rectangles and exact packed bytes', () => {
  expect(data.textures).toHaveLength(4);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(28);
  for (const t of data.textures) {
    const raw = readFileSync('public/' + t.url);
    expect(hash(raw)).toBe(t.sha256);
    expect(raw.length).toBe(t.bytes);
  }
});
test('the public swirls GLB loads in the application engine with source UV/color data and no generated normals', async () => {
  const descriptor = data.meshes[0],
    raw = readFileSync('public/' + descriptor.url);
  expect(hash(raw)).toBe(descriptor.sha256);
  expect(raw.length).toBe(descriptor.bytes);
  const loaded = await new GLTFLoader().parseAsync(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    ''
  );
  const meshes: THREE.Mesh[] = [];
  loaded.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  expect(meshes).toHaveLength(1);
  const g = meshes[0].geometry;
  expect(g.getAttribute('position').count).toBe(603);
  expect(g.index?.count).toBe(2376);
  expect(g.getAttribute('color').normalized).toBe(true);
  expect(g.getAttribute('uv').count).toBe(603);
  expect(g.getAttribute('normal')).toBeUndefined();
  g.dispose();
  (meshes[0].material as THREE.Material).dispose();
});
