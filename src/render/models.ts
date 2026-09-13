import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { Unit } from '../simulation/types';

export interface UnitModel {
  root: THREE.Group;
  limbs: THREE.Object3D[];
  weapon?: THREE.Object3D;
  cape?: THREE.Object3D;
  crystal?: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  actionName?: string;
  animationAttackTick?: number;
}
let referenceScene: THREE.Group | null = null;
let referenceClips: THREE.AnimationClip[] = [];
export async function loadReferenceModels(): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync('/assets/models/ashe-reference.glb');
  referenceScene = gltf.scene;
  referenceClips = gltf.animations;
  if (
    !referenceClips.some((clip) => clip.name === 'idle1') ||
    !referenceClips.some((clip) => clip.name === 'run')
  )
    throw new Error('Reference asset lacks required animations');
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
function link(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  color: number
): THREE.Mesh {
  const mesh = part(
    parent,
    new THREE.CylinderGeometry(radius, radius * 0.9, a.distanceTo(b), 6),
    color,
    0,
    0,
    0
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

export function makeModel(u: Unit): UnitModel {
  if (u.kind === 'champion' && referenceScene) {
    const root = new THREE.Group(),
      model = clone(referenceScene);
    root.add(model);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      referenceClips.map((clip) => [clip.name, mixer.clipAction(clip)])
    );
    actions.idle1.play();
    return { root, limbs: [], mixer, actions, actionName: 'idle1' };
  }
  if (u.kind === 'champion') return archer(u.team === 'blue');
  if (u.kind === 'turret') return turret(u.team === 'blue');
  if (u.kind === 'dummy') return targetDummy();
  return minion(u);
}
/** Temporary articulated reference silhouette; replace with the validated GLB asset pack. */
function archer(blue: boolean): UnitModel {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const cloth = blue ? 0x174d82 : 0x783e65,
    light = blue ? 0x4ba6d6 : 0xca6e84,
    gold = 0xc4ac6a,
    skin = 0xe0c9b0;
  const torso = part(body, new THREE.CylinderGeometry(0.21, 0.28, 0.58, 8), cloth, 0, 1.05, 0);
  torso.scale.z = 0.7;
  part(body, new THREE.SphereGeometry(0.17, 10, 8), skin, 0, 1.57, 0.02);
  const hood = part(
    body,
    new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65),
    cloth,
    0,
    1.64,
    -0.02
  );
  hood.rotation.x = -0.28;
  // Pale locks and a deep hood preserve the archer's read at the fixed gameplay camera.
  for (const side of [-1, 1]) {
    const hair = part(
      body,
      new THREE.ConeGeometry(0.075, 0.65, 5),
      0xe3dfd2,
      side * 0.16,
      1.37,
      0.09
    );
    hair.rotation.z = side * 0.1;
    part(body, new THREE.SphereGeometry(0.19, 8, 5), gold, side * 0.29, 1.24, 0).scale.set(
      1,
      0.43,
      1
    );
  }
  part(body, new THREE.CylinderGeometry(0.28, 0.28, 0.065, 8), gold, 0, 0.79, 0).scale.z = 0.8;
  part(body, new THREE.ConeGeometry(0.38, 0.57, 8), cloth, 0, 0.62, -0.02);
  const cape = part(body, new THREE.ConeGeometry(0.52, 1.22, 5, 1, true), cloth, 0, 0.89, -0.23);
  cape.scale.z = 0.4;
  cape.rotation.x = -0.23;
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 0.58, 0);
    body.add(leg);
    link(leg, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.42, 0.03), 0.08, 0x252e36);
    part(leg, new THREE.BoxGeometry(0.16, 0.15, 0.27), gold, 0, -0.46, 0.08);
    limbs.push(leg);
  }
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 1.23, 0);
  body.add(leftArm);
  link(leftArm, new THREE.Vector3(), new THREE.Vector3(-0.23, -0.2, 0.28), 0.065, skin);
  link(
    leftArm,
    new THREE.Vector3(-0.23, -0.2, 0.28),
    new THREE.Vector3(-0.18, -0.1, 0.58),
    0.065,
    cloth
  );
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 1.23, 0);
  body.add(rightArm);
  link(rightArm, new THREE.Vector3(), new THREE.Vector3(0.22, -0.17, 0.15), 0.065, skin);
  link(
    rightArm,
    new THREE.Vector3(0.22, -0.17, 0.15),
    new THREE.Vector3(-0.06, -0.1, 0.4),
    0.06,
    cloth
  );
  limbs.push(leftArm, rightArm);
  const bow = new THREE.Group();
  bow.position.set(-0.46, 1.1, 0.65);
  body.add(bow);
  const points = [
    new THREE.Vector3(0, -0.67, -0.08),
    new THREE.Vector3(-0.23, -0.35, 0.11),
    new THREE.Vector3(-0.15, 0, 0.18),
    new THREE.Vector3(-0.23, 0.35, 0.11),
    new THREE.Vector3(0, 0.67, -0.08),
  ];
  for (let i = 0; i < points.length - 1; i++) link(bow, points[i], points[i + 1], 0.048, light);
  link(bow, points[0], points[4], 0.009, 0xcef3f4);
  part(bow, new THREE.OctahedronGeometry(0.13), 0xb8edf4, -0.18, 0, 0.18).scale.set(0.5, 1.6, 0.5);
  root.scale.setScalar(1.1);
  return { root, limbs, weapon: rightArm, cape };
}
function minion(u: Unit): UnitModel {
  const root = new THREE.Group(),
    blue = u.team === 'blue';
  const color = blue ? 0x36659a : 0x993f49,
    trim = blue ? 0x95b9c5 : 0xc7a393;
  if (u.kind === 'siege') {
    part(root, new THREE.BoxGeometry(0.8, 0.5, 1.1), color, 0, 0.45, 0);
    for (const x of [-0.45, 0.45])
      for (const z of [-0.36, 0.36]) {
        const wheel = part(
          root,
          new THREE.CylinderGeometry(0.25, 0.25, 0.15, 10),
          0x554e40,
          x,
          0.25,
          z
        );
        wheel.rotation.z = Math.PI / 2;
      }
    const barrel = part(root, new THREE.CylinderGeometry(0.14, 0.18, 1.1, 8), trim, 0, 0.72, 0.35);
    barrel.rotation.x = Math.PI / 2;
    return { root, limbs: [] };
  }
  const limbs: THREE.Object3D[] = [];
  part(root, new THREE.ConeGeometry(0.32, 0.65, 7), color, 0, 0.48, 0);
  part(root, new THREE.SphereGeometry(0.22, 8, 6), trim, 0, 0.95, 0);
  const hat = part(
    root,
    new THREE.ConeGeometry(0.29, u.kind === 'caster' ? 0.55 : 0.2, 7),
    color,
    0,
    1.13,
    -0.03
  );
  hat.rotation.x = -0.18;
  for (const s of [-1, 1]) {
    const leg = part(root, new THREE.BoxGeometry(0.13, 0.28, 0.2), 0x3e3836, s * 0.14, 0.17, 0.02);
    limbs.push(leg);
    part(root, new THREE.SphereGeometry(0.12, 7, 5), trim, s * 0.29, 0.59, 0.05);
  }
  if (u.kind === 'caster') {
    part(root, new THREE.CylinderGeometry(0.035, 0.04, 1.05, 5), 0x806847, -0.37, 0.6, 0.14);
    part(root, new THREE.OctahedronGeometry(0.14), blue ? 0x6ccce9 : 0xf08080, -0.37, 1.2, 0.14);
  } else {
    const sword = part(root, new THREE.BoxGeometry(0.08, 0.65, 0.12), 0xc4c6b4, 0.39, 0.68, 0.19);
    sword.rotation.x = 0.4;
    const shield = part(
      root,
      new THREE.CylinderGeometry(0.23, 0.23, 0.08, 6),
      color,
      -0.35,
      0.64,
      0.15
    );
    shield.rotation.x = Math.PI / 2;
  }
  return { root, limbs };
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
  return { root, limbs: [], crystal };
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
  return { root, limbs: [] };
}
