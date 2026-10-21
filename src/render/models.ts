import { TargetPoseSampler } from './target-pose-sampler';
import type { ImpactRig } from '../content/impact-target';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { isStructureKind, type Unit } from '../simulation/types';
import { prepareAnimationBounds } from './animation-bounds';
import { removeConstantBoneTracks } from './constant-bone-tracks';

export interface UnitModel {
  root: THREE.Group;
  submeshes?: THREE.Object3D[];
  destroyedClip?: string;
  animateDestruction?: boolean;
  deadIdleClip?: string;
  destroyed?: boolean;
  destructionTick?: number;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  clipDurations?: Readonly<Record<string, number>>;
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
  'ashe-base',
  'lux-base',
  'garen-base',
  'blue-melee',
  'red-melee',
  'blue-caster',
  'red-caster',
  'blue-siege',
  'red-siege',
  'blue-super',
  'red-super',
  'blue-turret',
  'red-turret',
  'blue-nexus',
  'red-nexus',
  'blue-inhibitor',
  'red-inhibitor',
];
export async function loadReferenceModels(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    referenceNames.map(async (name) => {
      const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
      for (const required of /-(turret|nexus|inhibitor)$/.test(name)
        ? ['idle1']
        : name === 'ashe-base'
          ? [
              'idle1',
              'run',
              'attack1',
              'crit',
              'death',
              'idle5',
              'idle2',
              'spell1',
              'spell2',
              'spell3',
              'spell4',
            ]
          : name === 'lux-base'
            ? [
                'idle1',
                'run',
                'attack1',
                'crit',
                'attack2',
                'death',
                'spell1',
                'spell2',
                'spell3',
                'spell4',
                'idle3',
                'entry_b4dcde19',
              ]
            : name === 'garen-base'
              ? [
                  'idle1_base',
                  'run_base',
                  'attack1',
                  'crit',
                  'spell1',
                  'spell4_base',
                  'spell3_0',
                  'death',
                  'recall',
                ]
              : ['idle1', 'run', 'attack1', 'death'])
        if (!gltf.animations.some((clip) => clip.name === required))
          throw new Error(`${name} lacks required ${required} animation`);
      if (/-(turret|nexus|inhibitor)$/.test(name))
        prepareAnimationBounds(gltf.scene, gltf.animations);
      references.set(name, {
        scene: gltf.scene,
        clips: removeConstantBoneTracks(gltf.scene, gltf.animations),
      });
    })
  );
}
/** Sampler owns a private skeleton; loaded geometry, materials and clips stay shared. */
export function createTargetPoseSampler(rig: ImpactRig): TargetPoseSampler {
  const reference = references.get(rig);
  if (!reference) throw new Error(`Model not loaded: ${rig}`);
  return new TargetPoseSampler(reference.scene, reference.clips);
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
  if (
    u.kind === 'champion' ||
    u.kind === 'melee' ||
    u.kind === 'caster' ||
    u.kind === 'siege' ||
    u.kind === 'super' ||
    isStructureKind(u.kind)
  ) {
    const key = u.kind === 'champion' ? `${u.champion}-base` : `${u.team}-${u.kind}`;
    const reference = references.get(key);
    if (!reference) throw new Error(`Model not loaded: ${key}`);
    const root = new THREE.Group(),
      model = clone(reference.scene);
    root.add(model);
    const submeshes: THREE.Object3D[] = [];
    let sharedSkeleton: THREE.Skeleton | undefined;
    model.traverse((object) => {
      if (object.userData.submesh) {
        submeshes.push(object);
        object.visible = !object.userData.initiallyHidden;
      }
      if (object instanceof THREE.SkinnedMesh && isStructureKind(u.kind)) {
        if (!sharedSkeleton) sharedSkeleton = object.skeleton;
        else if (object.skeleton.bones.every((bone, i) => bone === sharedSkeleton!.bones[i]))
          object.skeleton = sharedSkeleton;
      }
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.frustumCulled = object.userData.animationBounds === true;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      reference.clips.map((clip) => [clip.name, mixer.clipAction(clip)])
    );
    const idleClip = u.champion === 'garen' ? 'idle1_base' : 'idle1';
    actions[idleClip].play();
    mixer.update(0);
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    });
    const bounds = new THREE.Box3();
    model.traverseVisible((object) => {
      if (object instanceof THREE.Mesh) bounds.expandByObject(object);
    });
    return {
      root,
      submeshes: isStructureKind(u.kind) ? submeshes : undefined,
      destroyedClip: model.userData.destroyedClip,
      animateDestruction: model.userData.animateDestruction,
      deadIdleClip: model.userData.deadIdleClip,
      mixer,
      actions,
      clipDurations: Object.fromEntries(reference.clips.map((clip) => [clip.name, clip.duration])),
      actionName: idleClip,
      barHeight: u.structure
        ? u.structure.healthBarHeight * 0.01
        : u.kind === 'champion'
          ? 2.3
          : bounds.max.y + 0.18,
      referenceAsset: key,
    };
  }
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
