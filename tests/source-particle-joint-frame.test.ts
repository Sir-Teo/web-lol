import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import data from '../src/content/masteryi-sword-particles.json';
import { swordGlowParticles } from '../src/render/masteryi-sword-particles';
import {
  SourceParticleSurfaces,
  type SurfaceProgram,
  type SurfaceGroup,
} from '../src/render/source-particle-surfaces';
function fixture(kind = 'quad', joint = true, bind = 1, local = true) {
  const w = new World(false),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(),
    texture = new THREE.Texture(),
    position = new THREE.Vector3(3, 4, 5),
    rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.7, 0.4)),
    particle = { ...swordGlowParticles(23, 5 / 60, Infinity, 'MasterYi_E_Sword1_buf')[0], bind },
    profiles = [{ ...data.profiles[0], kind, particleLocal: local }];
  if (kind === 'billboard') particle.rotation = [0, 0, 0];
  let current: { position: THREE.Vector3; rotation: THREE.Quaternion } | null = {
    position,
    rotation,
  };
  const group = { key: 'joint', startTick: 0, stopTick: Infinity, radius: 65, seed: 23 };
  const program: SurfaceProgram<SurfaceGroup> = {
    name: 'Joint fixture',
    attachment: 'joint',
    profiles,
    assets: () => ({
      texture: () => texture,
      mesh: () => {
        throw Error('No mesh');
      },
    }),
    accepts: () => true,
    *records() {
      yield { sourceId: w.hero.id, castTick: 0, group };
    },
    particles: () => [particle],
    birthVisible: () => true,
    visible: () => true,
    pose: () => ({ x: 0, y: 0, facing: 0 }),
    ...(joint ? { attachmentFrame: () => current } : {}),
  };
  const view = new SourceParticleSurfaces(scene, scene, () => 0, program);
  camera.quaternion.setFromEuler(new THREE.Euler(0.3, -0.5, 0.1));
  camera.updateMatrixWorld(true);
  return {
    w,
    view,
    camera,
    particle,
    position,
    rotation,
    update: () => view.update(w, 1, camera),
    missing: () => {
      current = null;
    },
    dispose: () => {
      view.dispose();
      texture.dispose();
    },
  };
}
test('full joint position and non-yaw rotation place a bound particle without mutating the frame', () => {
  const f = fixture(),
    position = f.position.clone(),
    rotation = f.rotation.clone();
  f.update();
  const mesh = [...f.view.models.values()][0],
    expected = position
      .clone()
      .add(
        new THREE.Vector3(-f.particle.offset[0], f.particle.offset[1], f.particle.offset[2])
          .multiplyScalar(0.01)
          .applyQuaternion(rotation)
      );
  expect(mesh.position.toArray()).toEqual(expected.toArray());
  const source = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        ...(f.particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
        'YXZ'
      )
    ),
    reflected = new THREE.Quaternion(source.x, -source.y, -source.z, source.w);
  expect(mesh.quaternion.angleTo(rotation.clone().multiply(reflected))).toBeLessThan(1e-7);
  expect(f.position.toArray()).toEqual(position.toArray());
  expect(f.rotation.toArray()).toEqual(rotation.toArray());
  f.dispose();
});
test('an explicitly attached local billboard uses its joint frame rather than camera facing', () => {
  const f = fixture('billboard');
  f.update();
  const mesh = [...f.view.models.values()][0];
  expect(mesh.quaternion.angleTo(f.rotation)).toBeLessThan(1e-7);
  expect(mesh.quaternion.angleTo(f.camera.quaternion)).toBeGreaterThan(0.1);
  f.dispose();
});
test('a missing attachment suppresses existing models without a root fallback', () => {
  const f = fixture();
  f.update();
  expect(f.view.models.size).toBe(1);
  f.missing();
  f.update();
  expect(f.view.models.size).toBe(0);
  f.dispose();
});
test.each([
  [0, true],
  [1, false],
])('joint adapter rejects unsupported bind/orientation %s/%s', (bind, local) => {
  const f = fixture('quad', true, bind as number, local as boolean);
  expect(() => f.update()).toThrow('fully bound local');
  f.dispose();
});
test('omitting the joint adapter preserves ordinary actor-root placement', () => {
  const f = fixture('quad', false);
  f.update();
  const mesh = [...f.view.models.values()][0];
  expect(mesh.position.toArray()).toEqual([
    -f.particle.offset[0] * 0.01 || 0,
    f.particle.offset[1] * 0.01,
    f.particle.offset[2] * 0.01,
  ]);
  f.dispose();
});
