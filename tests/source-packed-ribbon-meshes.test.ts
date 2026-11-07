import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { SourcePackedRibbonMeshes } from '../src/render/source-packed-ribbon-meshes';
import type { PackedTrailVertex } from '../src/render/source-packed-trail-ribbon';
const vertex = (index: number): PackedTrailVertex => ({
  position: new Float32Array([100 + index * 100, 200, 300]),
  uv: new Float32Array([0.25, 0.75]),
  cell: new Float32Array([0.5, 0.25]),
  multUv: null,
  multCell: null,
  color: new Float32Array([1, 0.5, 0.25, 0.75]),
  lookup: new Float32Array([0.2, 0.8]),
  erosion: 0.3,
});
function fixture() {
  const scene = new THREE.Scene(),
    texture = new THREE.Texture();
  const assets = {
    texture: () => texture,
    mesh: () => {
      throw Error('Procedural ribbons borrow no mesh');
    },
  };
  const material = vi.fn(
    () => new THREE.ShaderMaterial({ uniforms: { sourceTexture: { value: texture } } })
  );
  const layer = new SourcePackedRibbonMeshes(scene, material, (index) => ({
    name: 'source ribbon ' + index,
    renderOrder: 7,
  }));
  return { scene, texture, assets, material, layer };
}
test('packed ribbon buffers preserve shader attributes and convert source centimetres once', () => {
  const f = fixture(),
    mesh = f.layer.write(
      'left:47',
      47,
      Array.from({ length: 6 }, (_, i) => vertex(i)),
      f.assets
    )!;
  expect(mesh.geometry.drawRange.count).toBe(6);
  expect(mesh.userData.capacity).toBe(24);
  expect(mesh.geometry.getAttribute('position').getX(0)).toBe(1);
  expect(mesh.geometry.getAttribute('position').getY(0)).toBe(2);
  expect(mesh.geometry.getAttribute('position').getZ(0)).toBe(3);
  expect(mesh.geometry.getAttribute('sourceCell').getX(0)).toBe(0.5);
  expect(mesh.geometry.getAttribute('sourceMultUv').getX(0)).toBe(0);
  expect(mesh.geometry.getAttribute('sourceTint').getW(0)).toBe(0.75);
  expect(mesh.renderOrder).toBe(7);
  expect(mesh.frustumCulled).toBe(false);
  expect(mesh.material.uniforms.sourceTexture.value).toBe(f.texture);
  f.layer.dispose();
  f.texture.dispose();
});
test('growth replaces only owned geometry and refreshes bounds without replacing its material', () => {
  const f = fixture(),
    mesh = f.layer.write('left:47', 47, [vertex(0)], f.assets)!;
  const original = mesh.geometry,
    disposed = vi.spyOn(original, 'dispose'),
    material = mesh.material;
  expect(
    f.layer.write(
      'left:47',
      47,
      Array.from({ length: 40 }, (_, i) => vertex(i)),
      f.assets
    )
  ).toBe(mesh);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(mesh.material).toBe(material);
  expect(f.material).toHaveBeenCalledTimes(1);
  expect(mesh.userData.capacity).toBe(64);
  expect(mesh.geometry.boundingBox!.min.x).toBe(1);
  expect(mesh.geometry.boundingBox!.max.x).toBe(40);
  expect(mesh.geometry.boundingSphere!.radius).toBe(19.5);
  f.layer.dispose();
  f.texture.dispose();
});
test('empty/retired ribbons release their uploads exactly once without disposing borrowed textures', () => {
  const f = fixture();
  expect(f.layer.write('empty', 47, [], f.assets)).toBeNull();
  expect(f.material).not.toHaveBeenCalled();
  const mesh = f.layer.write('left:47', 47, [vertex(0)], f.assets)!;
  const geometry = vi.spyOn(mesh.geometry, 'dispose'),
    material = vi.spyOn(mesh.material, 'dispose'),
    texture = vi.spyOn(f.texture, 'dispose');
  expect(() => f.layer.write('left:47', 48, [vertex(0)], f.assets)).toThrow();
  f.layer.retain(new Set());
  f.layer.dispose();
  expect(f.scene.children).toHaveLength(0);
  expect(f.layer.models.size).toBe(0);
  expect(geometry).toHaveBeenCalledTimes(1);
  expect(material).toHaveBeenCalledTimes(1);
  expect(texture).not.toHaveBeenCalled();
  f.texture.dispose();
});
