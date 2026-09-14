import { expect, test } from 'vitest';
import * as THREE from 'three';
import { projectGroundBeam } from '../src/render/ground-beam';
const beam = {
  origin: { x: 0, y: 0 },
  target: { x: 3340, y: 0 },
  halfWidth: 100,
  sourceOffset: -150,
  targetOffset: 0,
};
test('ground beam retains source endpoint extension and width/length UV axes', () => {
  const g = new THREE.BufferGeometry();
  projectGroundBeam(g, beam, () => 0);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  expect(p.getX(0)).toBe(-1.5);
  expect(p.getZ(0)).toBe(-1);
  expect(p.getX(p.count - 1)).toBeCloseTo(33.4, 5);
  expect(p.getZ(p.count - 1)).toBe(1);
  expect([uv.getX(0), uv.getY(0)]).toEqual([0, 0]);
  expect([uv.getX(p.count - 1), uv.getY(p.count - 1)]).toEqual([1, 1]);
  const positions = p.array.slice(),
    indices = g.index;
  projectGroundBeam(g, { ...beam, halfWidth: 50 }, () => 0, 100);
  expect(g.getAttribute('position')).toBe(p);
  expect(g.index).toBe(indices);
  expect(p.getZ(0)).toBe(-0.5);
  projectGroundBeam(g, beam, () => 0);
  expect(p.array).toEqual(positions);
  expect([uv.getX(0), uv.getY(0)]).toEqual([0, 0]);
  g.dispose();
});
test('ground beam follows terrain across width and length after a diagonal cast transform', () => {
  const g = new THREE.BufferGeometry(),
    height = (p: { x: number; y: number }) => 0.2 * p.x - 0.1 * p.y;
  projectGroundBeam(g, { ...beam, origin: { x: 100, y: 200 }, target: { x: 900, y: 800 } }, height);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const along = -150 + 1150 * uv.getY(i),
      side = -100 + 200 * uv.getX(i),
      x = 100 + 0.8 * along - 0.6 * side,
      y = 200 + 0.6 * along + 0.8 * side;
    expect(p.getX(i)).toBeCloseTo(x * 0.01, 5);
    expect(p.getZ(i)).toBeCloseTo(y * 0.01, 5);
    expect(p.getY(i)).toBeCloseTo((height({ x, y }) + 2) * 0.01, 5);
  }
  g.dispose();
});
test('ground beam handles signed widths, degeneracy and invalid grid bounds', () => {
  const g = new THREE.BufferGeometry();
  projectGroundBeam(g, { ...beam, halfWidth: -100 }, () => 0);
  expect(g.getAttribute('position').getZ(0)).toBe(1);
  expect(() => projectGroundBeam(g, beam, () => 0, 50)).toThrow();
  expect(() => projectGroundBeam(g, beam, () => 0, NaN)).toThrow();
  projectGroundBeam(g, { ...beam, target: beam.origin }, () => 0);
  expect(g.drawRange.count).toBe(0);
  projectGroundBeam(g, { ...beam, halfWidth: 0 }, () => 0);
  expect(g.drawRange.count).toBe(0);
  g.dispose();
});
