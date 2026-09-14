import * as THREE from 'three';

/** Ground effects blend between environment surfaces and ordinary scene objects.
 * CustomBlending remains active with transparent=false in Three.js. This puts the
 * effect in the ordered opaque queue without changing its blend equation or depth
 * policy, and avoids a second scene pass/shadow render. */
export function groundEffectMaterial(material: THREE.Material): void {
  if (material.blending !== THREE.CustomBlending)
    throw new Error('Ground effects require explicit source blend factors');
  material.transparent = false;
  material.needsUpdate = true;
}

export type GroundRenderStage = 'terrain' | 'ground' | 'world';
const stages = new WeakMap<THREE.Object3D, GroundRenderStage>();

/** Tag the subtree's root; children added later inherit it, including nested groups. */
export function setGroundRenderStage(root: THREE.Object3D, stage: GroundRenderStage): void {
  stages.set(root, stage);
}
function stage(object: THREE.Object3D): number {
  for (let at: THREE.Object3D | null = object; at; at = at.parent) {
    const assigned = stages.get(at);
    if (assigned) return { terrain: 0, ground: 1, world: 2 }[assigned];
  }
  return 2;
}

interface Item {
  object: THREE.Object3D;
  groupOrder: number;
  renderOrder: number;
  material: { id: number };
  materialVariant?: number;
  z: number;
  id: number;
}
/** Source pass order applies within a display list, never across lists. The remaining
 * comparison follows Three.js's stable opaque ordering for the pinned runtime. */
export function groundDisplayListSort(a: Item, b: Item): number {
  return (
    stage(a.object) - stage(b.object) ||
    a.groupOrder - b.groupOrder ||
    a.renderOrder - b.renderOrder ||
    a.material.id - b.material.id ||
    // materialVariant is a runtime field not yet present in @types/three.
    (a.materialVariant ?? 0) - (b.materialVariant ?? 0) ||
    a.z - b.z ||
    a.id - b.id
  );
}
