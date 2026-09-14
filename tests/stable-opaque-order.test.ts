import { expect, test } from 'vitest';
import { MeshBasicMaterial, Object3D } from 'three';
import {
  setStableMaterialOrder,
  setStableObjectOrder,
  stableOpaqueSort,
  type OpaqueItem,
} from '../src/render/stable-opaque-order';

function item(): OpaqueItem & { material: MeshBasicMaterial & { id: number } } {
  const object = new Object3D();
  return {
    object,
    id: object.id,
    material: new MeshBasicMaterial() as MeshBasicMaterial & { id: number },
    groupOrder: 0,
    renderOrder: 0,
    z: 1,
  };
}

test('source material and object indices override asynchronous creation order', () => {
  const a = item(),
    b = item();
  setStableMaterialOrder(a.material, 1);
  setStableMaterialOrder(b.material, 0);
  expect(stableOpaqueSort(a, b)).toBeGreaterThan(0);
  b.material = a.material;
  setStableObjectOrder(a.object, 1);
  setStableObjectOrder(b.object, 0);
  expect(stableOpaqueSort(a, b)).toBeGreaterThan(0);
  a.z = 0;
  expect(stableOpaqueSort(a, b)).toBeLessThan(0);
  a.renderOrder = 1;
  expect(stableOpaqueSort(a, b)).toBeGreaterThan(0);
  a.groupOrder = -1;
  expect(stableOpaqueSort(a, b)).toBeLessThan(0);
});

test('untagged objects keep ordinary material, variant, depth and ID ordering', () => {
  const a = item(),
    b = item();
  expect(stableOpaqueSort(a, b)).toBe(a.material.id - b.material.id);
  b.material = a.material;
  a.materialVariant = 2;
  expect(stableOpaqueSort(a, b)).toBe(2);
  a.materialVariant = 0;
  a.z = 4;
  expect(stableOpaqueSort(a, b)).toBe(3);
  a.z = 1;
  expect(stableOpaqueSort(a, b)).toBe(a.id - b.id);
});
