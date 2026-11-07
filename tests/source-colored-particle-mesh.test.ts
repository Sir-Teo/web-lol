import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, test, vi } from 'vitest';
import { consumeSourceColoredParticleMesh } from '../src/render/source-colored-particle-mesh';

const positions = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) =>
  Array.from({ length: attribute.count }, (_, i) => [
    attribute.getX(i),
    attribute.getY(i),
    attribute.getZ(i),
  ]).flat();
const uvs = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) =>
  Array.from({ length: attribute.count }, (_, i) => [attribute.getX(i), attribute.getY(i)]).flat();

test('the native R mesh preserves topology/UVs and exact byte colors while converting source centimetres once', async () => {
  const bytes = Uint8Array.from(readFileSync('public/assets/effects/ahri-r-0216531e0d20ebea.glb')),
    gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  let mesh!: THREE.Mesh;
  gltf.scene.traverse((node) => {
    if (node instanceof THREE.Mesh) mesh = node;
  });
  const geometry = mesh.geometry,
    position = geometry.getAttribute('position'),
    originalPosition = positions(position),
    originalUv = uvs(geometry.getAttribute('uv')),
    originalIndex = Array.from(geometry.getIndex()!.array),
    color = geometry.getAttribute('color'),
    rgba = Uint8Array.from(
      Array.from({ length: color.count }, (_, i) =>
        [color.getX(i), color.getY(i), color.getZ(i), color.getW(i)].map((v) => Math.round(v * 255))
      ).flat()
    ),
    material = mesh.material as THREE.Material,
    disposeMaterial = vi.spyOn(material, 'dispose'),
    disposeGeometry = vi.spyOn(geometry, 'dispose');
  const actual = consumeSourceColoredParticleMesh(gltf.scene, { vertices: 230, triangles: 380 });
  expect(actual).toBe(geometry);
  expect(positions(actual.getAttribute('position'))).toEqual(
    Array.from(Float32Array.from(originalPosition, (v) => v * 0.01 + 0))
  );
  expect(uvs(actual.getAttribute('uv'))).toEqual(originalUv);
  expect(Array.from(actual.getIndex()!.array)).toEqual(originalIndex);
  expect(actual.getAttribute('normal')).toBeUndefined();
  const bgra = actual.getAttribute('_source_vertex_bgra');
  expect(bgra.itemSize).toBe(4);
  expect(bgra.normalized).toBe(true);
  const expected = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4)
    expected.set([rgba[i + 2], rgba[i + 1], rgba[i], rgba[i + 3]], i);
  expect(bgra.array).toEqual(expected);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(() =>
    consumeSourceColoredParticleMesh(gltf.scene, { vertices: 230, triangles: 380 })
  ).toThrow('already been consumed');
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(disposeGeometry).not.toHaveBeenCalled();
  actual.dispose();
});

function fixture() {
  const geometry = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 100, 0, 0, 0, 100, 0], 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2))
    .setAttribute(
      'color',
      new THREE.Uint8BufferAttribute([255, 128, 64, 32, 1, 2, 3, 4, 7, 8, 9, 10], 4, true)
    )
    .setIndex([0, 1, 2]);
  const material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.Mesh(geometry, material),
    scene = new THREE.Group();
  scene.add(mesh);
  return {
    geometry,
    material,
    mesh,
    scene,
    disposeGeometry: vi.spyOn(geometry, 'dispose'),
    disposeMaterial: vi.spyOn(material, 'dispose'),
  };
}

test.each(['transform', 'missing-color', 'bad-color', 'bad-index', 'bad-uv', 'wrong-count'])(
  'invalid %s releases staging geometry and material without publishing a partial conversion',
  (kind) => {
    const f = fixture();
    if (kind === 'transform') f.scene.position.x = 1;
    if (kind === 'missing-color') f.geometry.deleteAttribute('color');
    if (kind === 'bad-color')
      f.geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute([2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1], 4)
      );
    if (kind === 'bad-index') f.geometry.setIndex([0, 1, 3]);
    if (kind === 'bad-uv') f.geometry.getAttribute('uv').setX(0, NaN);
    expect(() =>
      consumeSourceColoredParticleMesh(f.scene, {
        vertices: kind === 'wrong-count' ? 4 : 3,
        triangles: 1,
      })
    ).toThrow();
    expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(f.disposeMaterial).toHaveBeenCalledTimes(1);
    expect(f.geometry.getAttribute('_source_vertex_bgra')).toBeUndefined();
    expect(f.geometry.userData.sourceCentimetresScaleApplied).toBeUndefined();
  }
);

test('invalid multiple meshes release shared staging resources exactly once', () => {
  const f = fixture();
  f.scene.add(new THREE.Mesh(f.geometry, f.material));
  expect(() => consumeSourceColoredParticleMesh(f.scene, { vertices: 3, triangles: 1 })).toThrow(
    'one untransformed static mesh'
  );
  expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
  expect(f.disposeMaterial).toHaveBeenCalledTimes(1);
});
