import { expect, test } from 'vitest';
import * as THREE from 'three';
import { clearBillboardLabel, type ScreenRect } from '../src/render/billboard-label-clearance';

const viewport = { left: 32, top: 48, width: 960, height: 720 };
/** Independent geometry oracle: project an actual PlaneGeometry's vertices. */
function bounds(
  center: THREE.Vector3,
  size: THREE.Vector2,
  camera: THREE.Camera,
  view: ScreenRect
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
  mesh.position.copy(center);
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.set(size.x, size.y, 1);
  mesh.updateMatrixWorld();
  const ps = mesh.geometry.getAttribute('position'),
    xs: number[] = [],
    ys: number[] = [];
  for (let i = 0; i < ps.count; i++) {
    const p = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(ps, i)).project(camera);
    xs.push(view.left + ((p.x + 1) * view.width) / 2);
    ys.push(view.top + ((1 - p.y) * view.height) / 2);
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}
for (const kind of ['perspective', 'orthographic'] as const)
  test(`${kind} clearance keeps the entire quad four CSS pixels above its readout at multiple zooms and canvas offsets`, () => {
    const camera =
      kind === 'perspective'
        ? new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 100)
        : new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
    camera.position.set(6, 8, 14);
    camera.lookAt(0, 0, 0);
    for (const zoom of [0.75, 1, 2.5]) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const center = new THREE.Vector3(1, 1.2, -0.4),
        original = center.clone(),
        size = new THREE.Vector2(0.5, 0.7);
      const before = bounds(center, size, camera, viewport),
        ndc = center.clone().project(camera),
        label = {
          left: (before.left + before.right) / 2 - 60,
          top: before.top + 5,
          width: 120,
          height: 24,
        };
      const scale = size.clone(),
        projection = camera.projectionMatrix.clone();
      const lift = clearBillboardLabel(center, size, camera, viewport, label),
        after = bounds(center, size, camera, viewport);
      expect(lift).toBeGreaterThan(0);
      expect(center.distanceTo(original)).toBeGreaterThan(0);
      expect(label.top - after.bottom).toBeCloseTo(4, 8);
      expect(after.right - after.left).toBeCloseTo(before.right - before.left, 8);
      expect(after.bottom - after.top).toBeCloseTo(before.bottom - before.top, 8);
      const projected = center.clone().project(camera);
      expect(projected.x).toBeCloseTo(ndc.x, 12);
      expect(projected.z).toBeCloseTo(ndc.z, 12);
      expect(size).toEqual(scale);
      expect(camera.projectionMatrix).toEqual(projection);
      const fixed = center.clone();
      expect(clearBillboardLabel(center, size, camera, viewport, label)).toBeLessThan(1e-8);
      expect(center.distanceTo(fixed)).toBeLessThan(1e-10);
    }
  });
test('separated labels and an already clear quad keep the preferred point unchanged', () => {
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  const newborn = new THREE.Vector3();
  expect(
    clearBillboardLabel(newborn, { x: 0, y: 0 }, camera, viewport, {
      left: 0,
      top: 0,
      width: 960,
      height: 720,
    })
  ).toBeGreaterThan(0);
  expect([...newborn].every(Number.isFinite)).toBe(true);
  const p = new THREE.Vector3(),
    size = new THREE.Vector2(0.5, 0.5),
    box = bounds(p, size, camera, viewport);
  for (const label of [
    { left: box.right + 10, top: box.top, width: 100, height: 30 },
    { left: box.left, top: box.bottom + 10, width: 100, height: 30 },
  ]) {
    expect(clearBillboardLabel(p, size, camera, viewport, label)).toBe(0);
    expect(p.toArray()).toEqual([0, 0, 0]);
  }
});
test('hidden/empty/invalid rectangles and clipped centers cannot produce nonfinite or invented positions', () => {
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  for (const label of [
    { left: 0, top: 0, width: 0, height: 30 },
    { left: NaN, top: 0, width: 100, height: 30 },
  ]) {
    const p = new THREE.Vector3();
    expect(clearBillboardLabel(p, { x: 1, y: 1 }, camera, viewport, label)).toBe(0);
    expect(p.toArray()).toEqual([0, 0, 0]);
  }
  for (const p of [new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 0, -200)]) {
    const before = p.clone();
    expect(
      clearBillboardLabel(p, { x: 1, y: 1 }, camera, viewport, {
        left: 0,
        top: 0,
        width: 960,
        height: 720,
      })
    ).toBe(0);
    expect(p).toEqual(before);
  }
});
