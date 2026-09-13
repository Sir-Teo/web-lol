import * as THREE from 'three';
import { HAWKSHOT_ECHO } from '../content/hawkshot-echo';
import { loadHawkshotGlow, createHawkshotGlow, animateHawkshotGlow } from './hawkshot-glow';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { configureHawkshotMaterial } from './hawkshot-material';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let reference: { scene: THREE.Group; clip: THREE.AnimationClip } | undefined;
const instances = new WeakMap<
  THREE.Group,
  { model: THREE.Object3D; mixer: THREE.AnimationMixer; glow: THREE.Group }
>();

export async function loadHawkshot(): Promise<void> {
  const [gltf] = await Promise.all([
    new GLTFLoader().loadAsync('/assets/models/hawkshot.glb'),
    loadHawkshotGlow(),
  ]);
  const clip = gltf.animations.find((clip) => clip.name === 'flight');
  if (!clip) throw new Error('Hawkshot lacks its source flight animation');
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) configureHawkshotMaterial(material);
    }
  });
  reference = { scene: gltf.scene, clip };
}

/** Source Owl1 body, Owl2 rim and two background quads. */
export function createHawkshot(): THREE.Group {
  if (!reference) throw new Error('Hawkshot model is not loaded');
  const root = new THREE.Group();
  const model = clone(reference.scene);
  const rotation = reference.scene.userData.emitterRotationDegrees as number[];
  model.rotation.set(...(rotation.map(THREE.MathUtils.degToRad) as [number, number, number]));
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      // The bird is small and deforming; a static bind-pose bound is unsafe.
      object.frustumCulled = false;
    }
  });
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(reference.clip).play();
  const glow = createHawkshotGlow();
  root.add(glow);
  instances.set(root, { model, mixer, glow });
  animateHawkshot(root, 0);
  return root;
}

export function animateHawkshot(root: THREE.Group, seconds: number): void {
  const state = instances.get(root)!;
  state.mixer.setTime(Math.max(0, seconds));
  animateHawkshotGlow(state.glow, Math.max(0, seconds));
  state.model.updateMatrixWorld(true);
  state.model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
  });
}

/** Release private pose resources, retaining the cached geometry/material/texture. */
export function disposeHawkshot(root: THREE.Group): boolean {
  const state = instances.get(root);
  if (!state) return false;
  state.mixer.stopAllAction();
  state.mixer.uncacheRoot(state.model);
  const skeletons = new Set<THREE.Skeleton>();
  state.model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  instances.delete(root);
  return true;
}

/** Reuse the exact source rim assets with a private material and particle-local animation. */
export function createHawkshotEcho() {
  if (!reference) throw new Error('Hawkshot model is not loaded');
  const root = clone(reference.scene);
  root.rotation.set(
    ...(reference.scene.userData.emitterRotationDegrees.map(THREE.MathUtils.degToRad) as [
      number,
      number,
      number,
    ])
  );
  let material: THREE.MeshBasicMaterial | undefined;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.material as THREE.MeshBasicMaterial;
    object.visible = source.userData.sourceEmitter === 'Owl2';
    object.frustumCulled = false;
    if (!object.visible) return;
    material = source.clone();
    material.userData = {
      ...source.userData,
      sourceEmitter: 'Owl3',
      fresnel: HAWKSHOT_ECHO.fresnel,
      fresnelColor: [...HAWKSHOT_ECHO.fresnelColor],
    };
    configureHawkshotMaterial(material);
    object.material = material;
    object.renderOrder = HAWKSHOT_ECHO.renderOrder;
  });
  if (!material) throw new Error('Hawkshot lacks the source rim for Owl3');
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(reference.clip).play();
  return { root, mixer, material };
}

export function disposeHawkshotEcho(echo: ReturnType<typeof createHawkshotEcho>) {
  echo.mixer.stopAllAction();
  echo.mixer.uncacheRoot(echo.root);
  const skeletons = new Set<THREE.Skeleton>();
  echo.root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  echo.material.dispose();
}
