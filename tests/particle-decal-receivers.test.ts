import { expect, test } from 'vitest';
import * as THREE from 'three';
import {
  decalWorldToUv,
  ParticleDecalReceivers,
  terrainDecalReceiver,
  type DecalFootprint,
} from '../src/render/particle-decal-receivers';

const footprint = (halfWidth = 1, halfHeight = 2, turn = 0.3): DecalFootprint => ({
  center: [0, 0, 0],
  halfWidth,
  halfHeight,
  turn,
});

test('the masked Rift ground patches remain eligible without accepting vegetation, props or instanced fixture scenery', () => {
  const material = new THREE.MeshBasicMaterial({ alphaTest: 0.30000001192092896 }),
    geometry = new THREE.PlaneGeometry(),
    mesh = new THREE.Mesh(geometry, material);
  for (const name of [
    'Ground_D4_DragonPit_A_MAT',
    'HOL2026_Ground_C3_MidLane_A_MAT',
    'Earth_Order_Gromp_A_MAT',
  ]) {
    material.name = 'Maps/KitPieces/SRS/Base/Materials/Default/' + name;
    expect(terrainDecalReceiver(mesh, material, 'rift')).toBe(true);
    expect(terrainDecalReceiver(mesh, material, 'practice-fixture')).toBe(false);
  }
  for (const name of [
    'Maps/KitPieces/SRX/Base/Models/LevelProp/Materials/VertexDeform_inst',
    'Maps/KitPieces/SRS/Base/Materials/Default/Chaos_Mid_A_MAT',
    'unclassified',
  ]) {
    material.name = name;
    expect(terrainDecalReceiver(mesh, material, 'rift')).toBe(false);
  }
  material.alphaTest = 0;
  expect(terrainDecalReceiver(mesh, material, 'practice-fixture')).toBe(true);
  const instances = new THREE.InstancedMesh(geometry, material, 1);
  expect(terrainDecalReceiver(instances, material, 'practice-fixture')).toBe(false);
  instances.dispose();
  geometry.dispose();
  material.dispose();
});
function plane() {
  const geometry = new THREE.BufferGeometry()
      .setAttribute(
        'position',
        new THREE.Float32BufferAttribute([-4, -13, -4, 4, 3, -4, 4, 27, 4, -4, 11, 4], 3)
      )
      .setIndex([0, 2, 1, 0, 3, 2]),
    material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(
      geometry,
      material
    ),
    root = new THREE.Group();
  root.add(mesh);
  return {
    geometry,
    material,
    mesh,
    root,
    release() {
      geometry.dispose();
      material.dispose();
    },
  };
}
function active(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute('position'),
    result: number[][] = [];
  for (let i = 0; i < geometry.drawRange.count; i++) result.push([p.getX(i), p.getY(i), p.getZ(i)]);
  return result;
}

test('explicit footprint inverse maps rotated corners to native row0/row2 UV without using height', () => {
  for (const turn of [0, 0.37, Math.PI / 2, -2.4]) {
    const p: DecalFootprint = { center: [7, 99, -4], halfWidth: 2, halfHeight: 3, turn },
      m = decalWorldToUv(p),
      c = Math.cos(turn),
      s = Math.sin(turn);
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const world = new THREE.Vector3(
          7 + c * x * 2 - s * z * 3,
          -300,
          -4 + s * x * 2 + c * z * 3
        ).applyMatrix4(m);
        expect(world.x).toBeCloseTo((x + 1) / 2, 12);
        expect(1 - world.z).toBeCloseTo((1 - z) / 2, 12);
      }
  }
});

test('clipping preserves the real sloped receiving plane, footprint area and UV bounds without normals or flattening', () => {
  const f = plane(),
    receiver = new ParticleDecalReceivers([f.root], () => true, 1),
    out = new THREE.BufferGeometry(),
    p = footprint(),
    r = receiver.write(out, p),
    points = active(out);
  expect(r.sourceTriangles).toBe(2);
  expect(r.candidates).toBe(2);
  expect(r.corners).toBeGreaterThan(0);
  let area = 0;
  for (const [x, y, z] of points) {
    expect(y).toBeCloseTo(2 * x + 3 * z + 7, 5);
    const uv = new THREE.Vector3(x, y, z).applyMatrix4(r.mapping);
    expect(uv.x).toBeGreaterThanOrEqual(-1e-7);
    expect(uv.x).toBeLessThanOrEqual(1 + 1e-7);
    expect(uv.z).toBeGreaterThanOrEqual(-1e-7);
    expect(uv.z).toBeLessThanOrEqual(1 + 1e-7);
  }
  for (let i = 0; i < points.length; i += 3) {
    const [a, b, c] = points.slice(i, i + 3);
    area += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
  }
  expect(area).toBeCloseTo(8, 6);
  expect(out.getAttribute('normal')).toBeUndefined();
  expect(out.getAttribute('uv')).toBeUndefined();
  expect(out.getIndex()).toBeNull();
  expect(out.getAttribute('position').count % 3).toBe(0);
  out.dispose();
  f.release();
});

test('an explicit source-X reflection changes the UV frame about its center without moving receiver geometry', () => {
  const turn = 0.7,
    c = Math.cos(turn),
    s = Math.sin(turn),
    p: DecalFootprint = { center: [4, 9, -2], halfWidth: 2, halfHeight: 3, turn, reflectX: true },
    m = decalWorldToUv(p);
  for (const u of [-1, 1])
    for (const v of [-1, 1]) {
      const world = new THREE.Vector3(
        4 - (c * u * 2 - s * v * 3),
        100,
        -2 + s * u * 2 + c * v * 3
      ).applyMatrix4(m);
      expect(world.x).toBeCloseTo((u + 1) / 2, 12);
      expect(1 - world.z).toBeCloseTo((1 - v) / 2, 12);
    }
  const f = plane(),
    receiver = new ParticleDecalReceivers([f.root], () => true, 1),
    out = new THREE.BufferGeometry();
  receiver.write(out, { ...footprint(), reflectX: true });
  for (const [x, y, z] of active(out)) expect(y).toBeCloseTo(2 * x + 3 * z + 7, 5);
  out.dispose();
  f.release();
});

test('parent reflection, scale and translation fold into world once and overlapping roots do not duplicate triangles', () => {
  const f = plane();
  f.root.position.set(10, 5, -6);
  f.root.scale.set(-2, 3, 0.5);
  const receiver = new ParticleDecalReceivers([f.root, f.mesh], () => true, 2),
    out = new THREE.BufferGeometry(),
    r = receiver.write(out, { center: [10, 0, -6], halfWidth: 10, halfHeight: 3, turn: 0 });
  expect(r.sourceTriangles).toBe(2);
  expect(active(out)).toHaveLength(6);
  for (const [x, y, z] of active(out)) {
    const localX = (10 - x) / 2,
      localZ = (z + 6) * 2;
    expect(y).toBeCloseTo(5 + 3 * (2 * localX + 3 * localZ + 7), 5);
    expect(Math.abs(localX)).toBe(4);
    expect(Math.abs(localZ)).toBe(4);
  }
  out.dispose();
  f.release();
});

test('receiver eligibility respects visible roots, material groups and draw ranges with explicit invalidation', () => {
  const f = plane(),
    other = new THREE.MeshBasicMaterial();
  f.material.name = 'terrain';
  other.name = 'excluded';
  f.mesh.material = [f.material, other];
  f.geometry.clearGroups();
  f.geometry.addGroup(0, 3, 0);
  f.geometry.addGroup(3, 3, 1);
  const receiver = new ParticleDecalReceivers([f.root], (_mesh, m) => m.name === 'terrain', 1),
    out = new THREE.BufferGeometry();
  receiver.write(out, footprint());
  expect(receiver.triangleCount).toBe(1);
  f.material.visible = false;
  receiver.invalidate();
  expect(receiver.write(out, footprint()).corners).toBe(0);
  f.material.visible = true;
  f.geometry.setDrawRange(3, 3);
  receiver.invalidate();
  expect(receiver.write(out, footprint()).corners).toBe(0);
  f.geometry.setDrawRange(0, Infinity);
  f.root.visible = false;
  receiver.invalidate();
  expect(receiver.write(out, footprint()).sourceTriangles).toBe(0);
  f.root.visible = true;
  receiver.invalidate();
  expect(receiver.write(out, footprint()).sourceTriangles).toBe(1);
  out.dispose();
  f.release();
  other.dispose();
});

test('static snapshots rebuild only on invalidation and never alter or dispose borrowed source resources', () => {
  const f = plane(),
    before = Array.from(f.geometry.getAttribute('position').array),
    version = (f.geometry.getAttribute('position') as THREE.BufferAttribute).version,
    receiver = new ParticleDecalReceivers([f.root], () => true, 1),
    out = new THREE.BufferGeometry();
  let borrowed = 0;
  for (const p of [f.geometry, f.material]) p.addEventListener('dispose', () => borrowed++);
  receiver.write(out, footprint());
  f.root.position.x = 20;
  expect(receiver.write(out, footprint()).corners).toBeGreaterThan(0);
  receiver.invalidate();
  expect(receiver.write(out, footprint()).corners).toBe(0);
  expect(receiver.write(out, { ...footprint(), center: [20, 0, 0] }).corners).toBeGreaterThan(0);
  expect(Array.from(f.geometry.getAttribute('position').array)).toEqual(before);
  expect((f.geometry.getAttribute('position') as THREE.BufferAttribute).version).toBe(version);
  receiver.invalidate([]);
  expect(receiver.triangleCount).toBe(0);
  expect(borrowed).toBe(0);
  out.dispose();
  f.release();
});

test('owned output capacity is reused while active bounds and empty ranges ignore stale vertices', () => {
  const f = plane(),
    receiver = new ParticleDecalReceivers([f.root], () => true, 0.5),
    out = new THREE.BufferGeometry();
  const first = receiver.write(out, footprint(2, 2, 0.3)),
    buffer = out.getAttribute('position').array;
  expect(first.candidates).toBe(2);
  receiver.write(out, { ...footprint(), center: [100, 0, 100] });
  expect(out.drawRange.count).toBe(0);
  expect(out.boundingBox!.isEmpty()).toBe(true);
  receiver.write(out, footprint(0.2, 0.1, 0));
  expect(out.getAttribute('position').array).toBe(buffer);
  expect(out.boundingBox!.max.x).toBeCloseTo(0.2);
  expect(out.boundingBox!.max.z).toBeCloseTo(0.1);
  expect(out.boundingBox!.max.y).toBeCloseTo(7.7);
  out.dispose();
  f.release();
});

test('invalid or unsafe footprint domains fail before spatial loops', () => {
  const receiver = new ParticleDecalReceivers([], () => true, 1),
    out = new THREE.BufferGeometry();
  expect(() => new ParticleDecalReceivers([], () => true, 0)).toThrow(RangeError);
  for (const p of [
    { ...footprint(), halfWidth: 0 },
    { ...footprint(), halfHeight: NaN },
    { ...footprint(), center: [1e20, 0, 0] as const },
    { ...footprint(), halfWidth: Number.MIN_VALUE },
  ])
    expect(() => receiver.write(out, p)).toThrow(RangeError);
  out.dispose();
});

test('invalid source indices, nonfinite positions and animated/instanced receivers fail closed', () => {
  for (const kind of ['index', 'position', 'skin', 'instance', 'matrix']) {
    const f = plane(),
      out = new THREE.BufferGeometry();
    if (kind === 'index') f.geometry.setIndex([0, 1, 99]);
    if (kind === 'position') f.geometry.getAttribute('position').setX(0, NaN);
    if (kind === 'skin' || kind === 'instance') {
      f.root.remove(f.mesh);
      f.root.add(
        kind === 'skin'
          ? new THREE.SkinnedMesh(f.geometry, f.material)
          : new THREE.InstancedMesh(f.geometry, f.material, 1)
      );
    }
    if (kind === 'matrix') {
      f.root.matrixAutoUpdate = false;
      f.root.matrix.elements[3] = 0.1;
      f.root.matrixWorldNeedsUpdate = true;
    }
    const receiver = new ParticleDecalReceivers([f.root], () => true, 1);
    expect(() => receiver.write(out, footprint()), kind).toThrow();
    out.dispose();
    f.release();
  }
});
