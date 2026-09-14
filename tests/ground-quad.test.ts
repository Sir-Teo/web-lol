import { expect, test } from 'vitest';
import * as THREE from 'three';
import { projectGroundQuad, type GroundQuad } from '../src/render/ground-quad';
import profiles from '../src/content/lux-ground-layers.json';

const quad: GroundQuad = {
  origin: { x: 100, y: 200 },
  target: { x: 1100, y: 200 },
  offset: [0, -160, 300],
  halfSize: [100, 200],
  rotation: [90, 0, 0],
};

test('ground quad retains source footprint, UV orientation and signed dimensions', () => {
  const g = new THREE.BufferGeometry();
  projectGroundQuad(g, quad, () => 30, 100);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  expect(p.count).toBe(15);
  expect(g.drawRange.count).toBe(48);
  expect([p.getX(0), p.getY(0), p.getZ(0)]).toEqual([2, expect.closeTo(0.32, 6), 1]);
  expect([p.getX(14), p.getY(14), p.getZ(14)]).toEqual([6, expect.closeTo(0.32, 6), 3]);
  expect([uv.getX(0), uv.getY(0), uv.getX(14), uv.getY(14)]).toEqual([0, 1, 1, 0]);
  const before = Array.from(p.array);
  projectGroundQuad(g, { ...quad, offset: [0, 999, 300] }, () => 30, 100);
  expect(Array.from(g.getAttribute('position').array)).toEqual(before);
  projectGroundQuad(g, { ...quad, halfSize: [-100, 200] }, () => 30, 100);
  expect(g.getAttribute('position').getZ(0)).toBe(3);
  expect(g.getAttribute('uv').getY(0)).toBe(1);
  g.dispose();
});

test('all source arbitrary ground rotations match independent Three Euler transforms on a slope', () => {
  const origin = { x: 130, y: -70 },
    target = { x: 930, y: 530 },
    forward = [0.8, 0.6],
    across = [-0.6, 0.8];
  for (const profile of profiles.filter((p) => p.geometry.kind === 'arbitraryQuad')) {
    const source = profile.geometry,
      g = new THREE.BufferGeometry();
    const q = {
      origin,
      target,
      offset: source.offset,
      halfSize: source.birthSize,
      rotation: source.rotation,
    };
    const height = (p: { x: number; y: number }) => p.x * 0.1 - p.y * 0.2;
    projectGroundQuad(g, q, height);
    const p = g.getAttribute('position'),
      uv = g.getAttribute('uv');
    const rotation = new THREE.Euler(
      ...(source.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
      'YXZ'
    );
    for (const at of [0, p.count - 1]) {
      const local = new THREE.Vector3(
        (1 - uv.getY(at) * 2) * source.birthSize[0],
        (uv.getX(at) * 2 - 1) * source.birthSize[1],
        0
      ).applyEuler(rotation);
      const x =
        origin.x +
        across[0] * (source.offset[0] + local.x) +
        forward[0] * (source.offset[2] + local.z);
      const y =
        origin.y +
        across[1] * (source.offset[0] + local.x) +
        forward[1] * (source.offset[2] + local.z);
      expect(p.getX(at)).toBeCloseTo(x * 0.01, 4);
      expect(p.getZ(at)).toBeCloseTo(y * 0.01, 4);
      expect(p.getY(at)).toBeCloseTo((height({ x, y }) + 2) * 0.01, 4);
    }
    g.dispose();
  }
});

test('interior projection follows curved terrain and reuses buffers for stable topology', () => {
  const g = new THREE.BufferGeometry(),
    height = (p: { x: number; y: number }) => 0.001 * (p.x * p.x + p.y * p.y);
  projectGroundQuad(g, quad, height, 50);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv'),
    indices = g.getIndex()!;
  for (let i = 0; i < p.count; i++)
    expect(p.getY(i)).toBeCloseTo(
      (height({ x: p.getX(i) * 100, y: p.getZ(i) * 100 }) + 2) * 0.01,
      4
    );
  for (let i = 0; i < indices.count; i += 3) {
    const vertices = [0, 1, 2].map((j) =>
      new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + j))
    );
    const center = vertices.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(3);
    expect(
      Math.abs(center.y - (height({ x: center.x * 100, y: center.z * 100 }) + 2) * 0.01)
    ).toBeLessThan(0.02);
  }
  projectGroundQuad(g, { ...quad, offset: [50, -100, 350] }, height, 50);
  expect(g.getAttribute('position')).toBe(p);
  expect(g.getAttribute('uv')).toBe(uv);
  expect(g.getIndex()).toBe(indices);
  projectGroundQuad(g, { ...quad, target: quad.origin }, height);
  expect(g.drawRange.count).toBe(0);
  projectGroundQuad(g, quad, height);
  expect(g.drawRange.count).toBeGreaterThan(0);
  g.dispose();
});

test('invalid projection inputs cannot create unbounded or nonfinite geometry', () => {
  const g = new THREE.BufferGeometry();
  for (const spacing of [0, -1, NaN, 0.01])
    expect(() => projectGroundQuad(g, quad, () => 0, spacing)).toThrow();
  expect(() => projectGroundQuad(g, quad, () => NaN)).toThrow();
  expect(() => projectGroundQuad(g, { ...quad, rotation: [90, NaN, 0] }, () => 0)).toThrow();
  g.dispose();
});
