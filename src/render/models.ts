import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { Unit } from '../simulation/types';

export interface UnitModel {
  root: THREE.Group;
  crystal?: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  actionName?: string;
  animationAttackTick?: number;
  barHeight?: number;
  referenceAsset?: string;
}
interface ReferenceModel {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}
const references = new Map<string, ReferenceModel>();
const referenceNames = [
  'ashe-reference',
  'blue-melee',
  'red-melee',
  'blue-caster',
  'red-caster',
  'blue-siege',
  'red-siege',
];
export async function loadReferenceModels(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    referenceNames.map(async (name) => {
      const gltf = await loader.loadAsync(`/assets/models/${name}.glb`);
      for (const required of ['idle1', 'run', 'attack1', 'death'])
        if (!gltf.animations.some((clip) => clip.name === required))
          throw new Error(`${name} lacks required ${required} animation`);
      references.set(name, { scene: gltf.scene, clips: gltf.animations });
    })
  );
}
const materials = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number, metalness = 0): THREE.MeshStandardMaterial {
  const key = color + metalness;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.48 : 0.85, metalness })
    );
  return materials.get(key)!;
}
function part(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  metalness = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mat(color, metalness));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function makeModel(u: Unit): UnitModel {
  if (u.kind === 'champion' || u.kind === 'melee' || u.kind === 'caster' || u.kind === 'siege') {
    const key = u.kind === 'champion' ? 'ashe-reference' : `${u.team}-${u.kind}`;
    const reference = references.get(key);
    if (!reference) throw new Error(`Model not loaded: ${key}`);
    const root = new THREE.Group(),
      model = clone(reference.scene);
    root.add(model);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      reference.clips.map((clip) => [clip.name, mixer.clipAction(clip)])
    );
    actions.idle1.play();
    mixer.update(0);
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    });
    const bounds = new THREE.Box3().setFromObject(model);
    return {
      root,
      mixer,
      actions,
      actionName: 'idle1',
      barHeight: u.kind === 'champion' ? 2.3 : bounds.max.y + 0.18,
      referenceAsset: key,
    };
  }
  if (u.kind === 'turret') return turret(u.team === 'blue');
  return targetDummy();
}

/** Release per-unit GPU state while preserving the shared reference asset. */
export function disposeModel(model: UnitModel): void {
  model.mixer?.stopAllAction();
  if (model.mixer) model.mixer.uncacheRoot(model.mixer.getRoot());
  const skeletons = new Set<THREE.Skeleton>();
  model.root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    if (object instanceof THREE.Mesh && !model.referenceAsset) object.geometry.dispose();
  });
  for (const skeleton of skeletons) skeleton.dispose();
}

function turret(blue: boolean): UnitModel {
  const root = new THREE.Group(),
    stone = 0x6e786f,
    dark = 0x414f4a,
    gold = 0x9f956d;
  part(root, new THREE.CylinderGeometry(1.15, 1.3, 0.22, 10), dark, 0, 0.1, 0);
  part(root, new THREE.CylinderGeometry(0.88, 1.1, 0.45, 8), stone, 0, 0.43, 0);
  part(root, new THREE.CylinderGeometry(0.56, 0.85, 1.4, 8), stone, 0, 1.25, 0);
  part(root, new THREE.CylinderGeometry(0.95, 0.65, 0.3, 8), gold, 0, 2.05, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const claw = part(
      root,
      new THREE.BoxGeometry(0.28, 1.25, 0.35),
      stone,
      Math.sin(a) * 0.67,
      2.4,
      Math.cos(a) * 0.67
    );
    claw.rotation.z = -Math.sin(a) * 0.22;
    claw.rotation.x = Math.cos(a) * 0.22;
  }
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.65),
    new THREE.MeshStandardMaterial({
      color: blue ? 0x78ddf3 : 0xf17c84,
      emissive: blue ? 0x169acc : 0xa81c39,
      emissiveIntensity: 1.2,
      roughness: 0.22,
      metalness: 0.25,
    })
  );
  crystal.scale.y = 1.7;
  crystal.position.y = 2.9;
  root.add(crystal);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.89, 0.035, 5, 32),
    mat(blue ? 0x75d8e5 : 0xdb8186)
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  root.add(ring);
  return { root, crystal };
}
function targetDummy(): UnitModel {
  const root = new THREE.Group();
  part(root, new THREE.CylinderGeometry(0.08, 0.12, 1.4, 6), 0x6d4d32, 0, 0.7, 0);
  part(root, new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24), 0x8b643c, 0, 1.15, 0).rotation.x =
    Math.PI / 2;
  for (const [radius, color] of [
    [0.43, 0xb9a67b],
    [0.31, 0x7c3c35],
    [0.18, 0xd0b76c],
  ] as const) {
    const circle = part(root, new THREE.CircleGeometry(radius, 24), color, 0, 1.15, 0.06);
    (circle.material as THREE.Material).side = THREE.DoubleSide;
  }
  return { root };
}
