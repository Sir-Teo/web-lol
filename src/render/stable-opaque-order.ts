import type * as THREE from 'three';

const materialOrder = new WeakMap<object, number>();
const objectOrder = new WeakMap<object, number>();

/** Source indices keep asynchronous loading out of static-map draw ordering. */
export function setStableMaterialOrder(material: THREE.Material, index: number): void {
  materialOrder.set(material, index);
}
export function setStableObjectOrder(object: THREE.Object3D, index: number): void {
  objectOrder.set(object, index);
}
export interface OpaqueItem {
  object: THREE.Object3D;
  groupOrder: number;
  renderOrder: number;
  material: { id: number };
  materialVariant?: number;
  z: number;
  id: number;
}
/** Preserve Three's opaque batching/depth priorities, with stable source keys
 * where available. Untagged runtime objects retain the ordinary ordering. */
export function stableOpaqueSort(a: OpaqueItem, b: OpaqueItem): number {
  return (
    a.groupOrder - b.groupOrder ||
    a.renderOrder - b.renderOrder ||
    (materialOrder.get(a.material) ?? a.material.id) -
      (materialOrder.get(b.material) ?? b.material.id) ||
    (a.materialVariant ?? 0) - (b.materialVariant ?? 0) ||
    a.z - b.z ||
    (objectOrder.get(a.object) ?? a.id) - (objectOrder.get(b.object) ?? b.id)
  );
}
