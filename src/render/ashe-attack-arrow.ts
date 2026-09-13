import {
  loadArrowGlow,
  createArrowGlow,
  animateArrowGlow,
  disposeArrowGlow,
} from './ashe-arrow-glow';
import { ASHE_BASIC_ARROW_SCALE } from '../content/ashe-basic-arrow';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let reference: THREE.Group | undefined;
const instances = new WeakMap<THREE.Group, { glow: THREE.Group; empowered: boolean }>();

export async function loadAsheAttackArrow(): Promise<void> {
  const [gltf] = await Promise.all([
    new GLTFLoader().loadAsync('assets/models/ashe-q-arrow.glb'),
    loadArrowGlow(),
  ]);
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
  const glow = createArrowGlow(empowered);
  root.add(glow);
  instances.set(root, { glow, empowered });
  return root;
}

export function animateAsheAttackArrow(model: THREE.Group, age: number): void {
  const instance = instances.get(model);
  if (instance) animateArrowGlow(instance.glow, instance.empowered, age);
}
export function disposeAsheAttackArrow(model: THREE.Group): boolean {
  const instance = instances.get(model);
  if (!instance) return false;
  disposeArrowGlow(instance.glow);
  instances.delete(model);
  return true;
}
