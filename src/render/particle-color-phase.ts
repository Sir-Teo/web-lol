import * as THREE from 'three';
import type { ParticleDistortionPass } from './particle-distortion-pass';

const colorMaterials = new WeakSet<THREE.Material>();
/** Explicit membership in the local source-particle color list. Untagged
 * geometry remains in the base scene, including characters. This is not native
 * CPU phase classification, and legacy unregistered effects retain base order. */
export function particleColorMaterial<T extends THREE.Material>(material: T): T {
  colorMaterials.add(material);
  return material;
}

/** Optional pre-color capture for registered source surfaces/skins/decals.
 * With no early draws the existing single scene render is unchanged. With early
 * draws: base scene (including actors/shadows), one early copy, registered color.
 * The later distortion copy stays caller-owned. No scene objects are reparented.
 * Registered particle materials must not cast shadows: the base pass preserves
 * every ordinary caster while later passes reuse its shadow/depth maps. */
export function renderParticleColorPhase(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  early: ParticleDistortionPass
): boolean {
  if (!early.hasDraws(camera)) {
    renderer.render(scene, camera);
    early.render(renderer, camera); // Retire a previously active framebuffer copy.
    return false;
  }
  if (renderer.getRenderTarget() !== null || scene.overrideMaterial !== null)
    throw Error('Particle color phase requires the canvas and original scene materials');
  const materials = new Map<THREE.Material, boolean>();
  scene.traverseVisible((object) => {
    if (!(
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ))
      return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!materials.has(material)) materials.set(material, material.visible);
      if (material.visible && colorMaterials.has(material) && object.castShadow)
        throw Error('Particle color phase requires non-shadow-casting particle materials');
    }
  });
  const background = scene.background,
    matrixUpdate = scene.matrixWorldAutoUpdate,
    autoClear = renderer.autoClear,
    shadowUpdate = renderer.shadowMap.autoUpdate,
    autoReset = renderer.info.autoReset;
  try {
    for (const [material, visible] of materials)
      material.visible = visible && !colorMaterials.has(material);
    renderer.render(scene, camera);
    // Matrices and ordinary actor shadow maps were updated by the full base
    // traversal. Keep its depth/color, background and accounting for both passes.
    scene.matrixWorldAutoUpdate = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.info.autoReset = false;
    early.render(renderer, camera);
    for (const [material, visible] of materials)
      material.visible = visible && colorMaterials.has(material);
    scene.background = null;
    renderer.autoClear = false;
    renderer.render(scene, camera);
    return true;
  } finally {
    for (const [material, visible] of materials) material.visible = visible;
    scene.background = background;
    scene.matrixWorldAutoUpdate = matrixUpdate;
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadowUpdate;
    renderer.info.autoReset = autoReset;
  }
}
