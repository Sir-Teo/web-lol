import { stableOpaqueSort, type OpaqueItem } from './stable-opaque-order';
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

export type GroundRenderStage = 'terrain' | 'terrainBlend' | 'ground' | 'world';
const stages = new WeakMap<THREE.Object3D, GroundRenderStage>();

/** Tag the subtree's root; children added later inherit it, including nested groups. */
export function setGroundRenderStage(root: THREE.Object3D, stage: GroundRenderStage): void {
  stages.set(root, stage);
}
function stage(object: THREE.Object3D): number {
  for (let at: THREE.Object3D | null = object; at; at = at.parent) {
    const assigned = stages.get(at);
    if (assigned) return { terrain: 0, terrainBlend: 1, ground: 2, world: 3 }[assigned];
  }
  return 3;
}

/** Source pass order applies within a display list, never across lists. The remaining
 * comparison follows Three.js's stable opaque ordering for the pinned runtime. */
export function groundDisplayListSort(a: OpaqueItem, b: OpaqueItem): number {
  return (
    stage(a.object) - stage(b.object) ||
    a.groupOrder - b.groupOrder ||
    a.renderOrder - b.renderOrder ||
    // Blended terrain retains the transparent queue's back-to-front ordering.
    (stage(a.object) === 1 ? b.z - a.z || a.id - b.id : 0) ||
    stableOpaqueSort(a, b)
  );
}

/** Move a normal-alpha, single-sided terrain surface into its explicit stage.
 * Keep opacity, depth and premultiplication; spell out Three.js NormalBlending's
 * separate RGB/alpha factors before disabling transparent queue membership. */
export function terrainBlendMaterial(material: THREE.Material): void {
  if (
    !material.transparent ||
    material.blending !== THREE.NormalBlending ||
    material.side === THREE.DoubleSide
  )
    throw new Error('Blended terrain requires single-sided normal-alpha material');
  material.blending = THREE.CustomBlending;
  material.blendEquation = material.blendEquationAlpha = THREE.AddEquation;
  material.blendSrc = material.premultipliedAlpha ? THREE.OneFactor : THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  material.transparent = false;
  material.needsUpdate = true;
}
