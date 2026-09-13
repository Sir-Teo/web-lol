import { ASHE_BASIC_ARROW_SCALE } from '../content/ashe-basic-arrow';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let reference: THREE.Group | undefined;
const instances = new WeakSet<THREE.Group>();

export async function loadAsheAttackArrow(): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync('assets/models/ashe-q-arrow.glb');
  const emitter = gltf.scene.userData.sourceEmitter;
  if (emitter?.emitterName !== 'icearrow' || emitter.disabled || emitter.blendMode !== 3)
    throw new Error('Q arrow lacks its active source emitter');
  reference = gltf.scene;
}

/** Shared immutable geometry/materials; remove instances without disposing the cache. */
export function createAsheAttackArrow(empowered: boolean): THREE.Group {
  if (!reference) throw new Error('Q arrow is not loaded');
  const root = new THREE.Group();
  root.name = empowered ? 'Ashe Q ice arrow' : 'Ashe basic ice arrow';
  const model = reference.clone(true);
  const scale = reference.userData.sourceEmitter.birthScale0.constantValue as [
    number,
    number,
    number,
  ];
  const selectedScale = empowered ? scale : ASHE_BASIC_ARROW_SCALE;
  model.scale.set(selectedScale[0], selectedScale[1], selectedScale[2]);
  // The source mesh tip is -Z; this renderer's projectile forward axis is +Z.
  // Particle-system attachment rotation/offset still requires native calibration.
  model.rotation.y = Math.PI;
  root.add(model);
  instances.add(root);
  return root;
}

export function isAsheAttackArrow(model: THREE.Group): boolean {
  return instances.has(model);
}
