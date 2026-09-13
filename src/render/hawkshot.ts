import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { configureHawkshotMaterial } from './hawkshot-material';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let reference: { scene: THREE.Group; clip: THREE.AnimationClip } | undefined;
const instances = new WeakMap<
  THREE.Group,
  { model: THREE.Object3D; mixer: THREE.AnimationMixer }
>();

export async function loadHawkshot(): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync('/assets/models/hawkshot.glb');
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

/** Source Owl1 body and Owl2 rim; remaining particle layers are still absent. */
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
  instances.set(root, { model, mixer });
  animateHawkshot(root, 0);
  return root;
}

export function animateHawkshot(root: THREE.Group, seconds: number): void {
  const state = instances.get(root)!;
  state.mixer.setTime(Math.max(0, seconds));
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
