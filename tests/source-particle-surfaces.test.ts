import { afterEach, expect, test } from 'vitest';
import * as THREE from 'three';
import data from '../src/content/masteryi-primary-hit-particles.json';
import { primaryHitParticles } from '../src/render/masteryi-primary-hit-particles';
import {
  SourceParticleSurfaces,
  type SurfaceProfile,
  type SurfaceProgram,
  type SurfaceGroup,
} from '../src/render/source-particle-surfaces';
import type { World } from '../src/simulation/world';
import { sourceParticlePostRotation } from '../src/render/source-particle-post-rotation';

const owned: { surface: SourceParticleSurfaces<SurfaceGroup>; texture: THREE.Texture }[] = [];
afterEach(() => {
  for (const f of owned.splice(0)) {
    f.surface.dispose();
    f.texture.dispose();
  }
});
function fixture(direction = false, attached = false, packet = false) {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    particle = {
      ...primaryHitParticles(91, 0.05, 'attack1', 30).find((p) => p.profileIndex === 1)!,
      profileIndex: 0,
      offset: [0, 0, 0],
      rotation: [0, 0, 0],
      travel: [0, 60, 0],
      color: Object.freeze([0.25, 0.5, 0.75, 0.5]) as unknown as number[],
      bind: 1,
    },
    profile = {
      ...data.profiles[1],
      ...(packet ? { kind: 'ray', blend: 4 } : {}),
      directionOriented: direction,
      particleLocal: attached,
    } as unknown as SurfaceProfile,
    group: SurfaceGroup = { key: 'test', startTick: 0, stopTick: 20, radius: 30, seed: 91 },
    frame = {
      position: new THREE.Vector3(1, 2, 3),
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.4, 0.3, 'YXZ')),
    },
    program: SurfaceProgram<SurfaceGroup> = {
      name: 'test',
      attachment: 'test',
      profiles: [profile],
      assets: () => ({
        texture: () => texture,
        mesh: () => {
          throw Error('Unexpected mesh');
        },
      }),
      accepts: () => true,
      ...(packet ? { vertexColor: () => 'bgra-unorm8' as const } : {}),
      records: () => [{ sourceId: 1, castTick: 0, group }],
      particles: () => [particle],
      birthVisible: () => true,
      pose: () => ({ x: 0, y: 0, facing: 0 }),
      ...(attached ? { attachmentFrame: () => frame } : {}),
    },
    world = { tick: 4, winner: null, pointVisible: () => true } as unknown as World,
    surface = new SourceParticleSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0, program),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  owned.push({ surface, texture });
  const update = () => {
    surface.update(world, 1, camera);
    return [...surface.models.values()][0];
  };
  return { surface, camera, program, particle, update };
}

test('source colors and caller-packed tint remain independently owned', () => {
  const f = fixture(),
    mesh = f.update();
  expect(mesh.material.uniforms.particleColor.value.toArray()).toEqual([0.125, 0.25, 0.375, 0.5]);
  const packed = Object.freeze([0.1, 0.2, 0.3, 0.4]);
  f.program.tint = () => packed;
  f.update();
  expect(mesh.material.uniforms.particleColor.value.toArray()).toEqual(packed);
  expect(f.particle.color).toEqual([0.25, 0.5, 0.75, 0.5]);
  expect(packed).toEqual([0.1, 0.2, 0.3, 0.4]);
});

test('direction-oriented billboards update when the same renderer changes cameras', () => {
  const f = fixture(true),
    first = f.update().quaternion.clone();
  f.camera.position.set(4, 3, 2);
  f.camera.lookAt(0, 0, 0);
  const moved = f.update().quaternion.clone();
  expect(moved.equals(first)).toBe(false);
  const fresh = fixture(true);
  fresh.camera.position.set(4, 3, 2);
  fresh.camera.lookAt(0, 0, 0);
  expect(moved.toArray()).toEqual(fresh.update().quaternion.toArray());
  f.camera.position.set(0, 0, 5);
  f.camera.lookAt(0, 0, 0);
  expect(f.update().quaternion.toArray()).toEqual(first.toArray());
});

test('programs can retain source-sampled stretch while legacy world-travel binding stays unchanged', () => {
  const f = fixture(true);
  f.program.profiles = [{ ...f.program.profiles[0], directionVelocityScale: 0 }];
  f.program.particles = () => [{ ...f.particle, stretch: 1.3, worldTravel: [0, 0, 0] }];
  expect(f.update().scale.y).toBe(f.particle.size[1] * 0.01);
  f.program.sampledStretch = true;
  expect(f.update().scale.y).toBe(f.particle.size[1] * 1.3 * 0.01);
});

test('attached billboards retain their complete reflected source rotation', () => {
  const f = fixture(false, true);
  f.particle.rotation = [13, -27, 51];
  const mesh = f.update();
  expect(mesh.position.toArray()).toEqual([1, 2, 3]);
  const expected = [
    0.10729402243043548, 0.09546386065049015, -0.2632953295880039, 0.9539655200674422,
  ];
  mesh.quaternion
    .toArray()
    .forEach((value, index) => expect(value).toBeCloseTo(expected[index], 12));
});

test('packed ray color owns a normalized BGRA byte stream and preserves caller values', () => {
  const f = fixture(false, false, true),
    mesh = f.update(),
    attribute = mesh.geometry.getAttribute('_source_vertex_bgra') as THREE.BufferAttribute,
    bytes = attribute.array;
  expect(attribute.normalized).toBe(true);
  expect(attribute.count).toBe(6);
  expect(attribute.usage).toBe(THREE.DynamicDrawUsage);
  expect(Array.from(bytes)).toEqual(Array.from({ length: 6 }, () => [191, 128, 64, 128]).flat());
  expect(mesh.material.defines.SOURCE_VERTEX_BGRA).toBe(1);
  expect(mesh.material.uniforms.particleColor.value.toArray()).toEqual([1, 1, 1, 1]);
  expect(f.particle.color).toEqual([0.25, 0.5, 0.75, 0.5]);
  const packed = Object.freeze([1, 0.5, 0, 0.5039215683937073]);
  f.program.tint = () => packed;
  f.update();
  expect(mesh.geometry.getAttribute('_source_vertex_bgra').array).toBe(bytes);
  expect(Array.from(bytes)).toEqual(Array.from({ length: 6 }, () => [0, 128, 255, 129]).flat());
  expect(packed).toEqual([1, 0.5, 0, 0.5039215683937073]);
});

test('unrequested surfaces retain uniform color and shared billboard geometry', () => {
  const first = fixture(),
    second = fixture();
  const a = first.update(),
    b = second.update();
  expect(a.geometry).toBe(b.geometry);
  expect(a.geometry.getAttribute('_source_vertex_bgra')).toBeUndefined();
  expect(a.material.defines.SOURCE_VERTEX_BGRA).toBeUndefined();
});

test('explicit post-rotation bases compose before attachment reflection and preserve the legacy fallback', () => {
  const f = fixture(false, true);
  f.particle.rotation = [17, -31, 43];
  const legacy = f.update().quaternion.clone();
  const basis = sourceParticlePostRotation(f.particle.rotation, [90, 0, 0]);
  f.program.particles = () => [{ ...f.particle, sourceBasis: basis }];
  const actual = f.update().quaternion.clone();
  const spin = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(f.particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
      'YXZ'
    )
  );
  const post = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'YXZ'));
  const composed = post.multiply(spin);
  const reflected = new THREE.Quaternion(composed.x, -composed.y, -composed.z, composed.w);
  const frame = f.program.attachmentFrame!({} as SurfaceGroup);
  const expected = frame!.rotation.clone().multiply(reflected);
  expect(actual.angleTo(expected)).toBeLessThan(1e-6);
  expect(actual.angleTo(legacy)).toBeGreaterThan(1);
  expect(basis).toEqual(sourceParticlePostRotation(f.particle.rotation, [90, 0, 0]));
  f.program.particles = () => [f.particle];
  expect(f.update().quaternion.toArray()).toEqual(legacy.toArray());
});

test('invalid explicit rotation matrices reject before drawing', () => {
  const f = fixture(false, true);
  for (const basis of [[1, 2], Array(9).fill(NaN), Array(9).fill(Infinity)]) {
    f.program.particles = () => [{ ...f.particle, sourceBasis: basis }];
    expect(() => f.update()).toThrow('rotation basis');
  }
});
