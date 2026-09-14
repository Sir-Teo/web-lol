import { expect, it } from 'vitest';
import * as THREE from 'three';
import { luxImpactSparkBirth, luxImpactSparks } from '../src/render/lux-impact-sparks';
import { LuxImpactSparkCloud } from '../src/render/lux-impact-spark-cloud';
import profile from '../src/content/lux-impact-sparks.json';

it('uses one chance across the authored spark life, velocity and scale distributions', () => {
  const low = luxImpactSparkBirth(0),
    high = luxImpactSparkBirth(1),
    mid = luxImpactSparkBirth(0.5);
  expect(low.life).toBeCloseTo(0.16, 6);
  expect(mid.life).toBeCloseTo(0.28, 6);
  expect(high.life).toBeCloseTo(0.4, 6);
  expect(low.velocity).toEqual([800, -400, -1800]);
  expect(high.velocity).toEqual([-800, 800, 1800]);
  expect(mid.velocity[0]).toBe(-0);
  expect(mid.velocity[2]).toBe(0);
  expect(low.scale).toEqual([10, 20, 0]);
  expect(high.scale).toEqual([20, 60, 0]);
  expect(() => luxImpactSparkBirth(-0.1)).toThrow(RangeError);
});
it('creates exactly five stable sparks and matches independently stepped drag including fractional age', () => {
  const born = luxImpactSparks(42, 0);
  expect(born).toHaveLength(5);
  const age = 7.3 / 60;
  for (const p of luxImpactSparks(42, age)) {
    const birth = luxImpactSparkBirth(p.chance);
    const position = [0, 0, 0],
      velocity = [...birth.velocity];
    for (let tick = 0; tick < 7; tick++)
      for (let axis = 0; axis < 3; axis++) {
        velocity[axis] *= 1 - profile.drag[axis] / 60;
        position[axis] += velocity[axis] / 60;
      }
    for (let axis = 0; axis < 3; axis++) {
      velocity[axis] *= 1 - profile.drag[axis] / 60;
      position[axis] += (velocity[axis] / 60) * 0.3;
      expect(p.position[axis]).toBeCloseTo(position[axis], 10);
      expect(p.velocity[axis]).toBeCloseTo(velocity[axis], 10);
    }
    expect(p.stretch).toBeCloseTo(
      Math.max(profile.directionMin, Math.hypot(...velocity) * profile.directionScale),
      10
    );
  }
  const old = luxImpactSparks(42, 0.12);
  luxImpactSparks(99, 0.39);
  expect(luxImpactSparks(42, 0.12)).toEqual(old);
  for (const p of born)
    expect(luxImpactSparks(42, p.life).some((s) => s.ordinal === p.ordinal)).toBe(false);
  expect(luxImpactSparks(42, 0.401)).toEqual([]);
  expect(luxImpactSparks(42, -1)).toEqual([]);
});
it('faces a rotated camera with the long axis along projected travel and retires instances', () => {
  const texture = new THREE.Texture(),
    cloud = new LuxImpactSparkCloud(texture, texture, texture);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(3, 4, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const particles = cloud.draw(42, 0.06, camera);
  expect(cloud.mesh.count).toBe(5);
  const matrix = new THREE.Matrix4(),
    cameraForward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  particles.forEach((p, i) => {
    cloud.mesh.getMatrixAt(i, matrix);
    const up = new THREE.Vector3().setFromMatrixColumn(matrix, 1).normalize();
    const projected = new THREE.Vector3(...(p.velocity as [number, number, number]))
      .projectOnPlane(cameraForward)
      .normalize();
    expect(up.dot(projected)).toBeCloseTo(1, 6);
    const normal = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize();
    expect(normal.dot(cameraForward)).toBeCloseTo(1, 6);
  });
  cloud.draw(42, 0.5, camera);
  expect(cloud.mesh.count).toBe(0);
  let disposed = false;
  texture.addEventListener('dispose', () => (disposed = true));
  cloud.dispose();
  expect(disposed).toBe(false);
});
