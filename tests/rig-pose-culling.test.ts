import * as THREE from 'three';
import { expect, test } from 'vitest';
import { RigPoseCulling } from '../src/render/rig-pose-culling';

function camera() {
  const c = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  c.position.z = 10;
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}
function rig() {
  const root = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  mesh.userData.animationBounds = true;
  root.add(mesh);
  root.position.x = 50;
  return { root, mesh };
}

test('first samples stay awake, then current camera and parent placement control sleeping', () => {
  const { root } = rig(),
    c = camera(),
    gate = new RigPoseCulling();
  gate.beginFrame(c);
  expect(gate.canSkip(root)).toBe(false);
  expect(gate.canSkip(root)).toBe(true);
  const parent = new THREE.Group();
  parent.add(root);
  parent.position.x = -50;
  expect(gate.canSkip(root)).toBe(false);
  parent.position.x = 0;
  expect(gate.canSkip(root)).toBe(true);
  c.position.x = 50;
  c.lookAt(50, 0, 0);
  c.updateMatrixWorld();
  gate.beginFrame(c);
  expect(gate.canSkip(root)).toBe(false);
});

test('offscreen casters stay awake inside the current directional shadow frustum', () => {
  const { root } = rig(),
    c = camera(),
    gate = new RigPoseCulling();
  const sun = new THREE.DirectionalLight();
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(50, 0, 10);
  sun.target.position.set(50, 0, 0);
  gate.beginFrame(c, sun);
  expect(gate.canSkip(root)).toBe(false);
  expect(gate.canSkip(root)).toBe(false);
  sun.position.x = sun.target.position.x = 0;
  gate.beginFrame(c, sun);
  expect(gate.canSkip(root)).toBe(true);
});

test('unsupported rigs stay awake, and hidden supported submeshes remain in the envelope', () => {
  const { root, mesh } = rig(),
    gate = new RigPoseCulling();
  gate.beginFrame(camera());
  const unsupported = root.clone();
  unsupported.children[0].userData.animationBounds = false;
  expect(gate.canSkip(unsupported)).toBe(false);
  expect(gate.canSkip(unsupported)).toBe(false);
  const hidden = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
  hidden.boundingSphere = mesh.boundingSphere.clone();
  hidden.userData.animationBounds = true;
  hidden.position.x = -50;
  hidden.visible = false;
  root.add(hidden);
  expect(gate.canSkip(root)).toBe(false);
  expect(gate.canSkip(root)).toBe(false);
});

test('a newly visible submesh must sample its original sort sphere before sleeping', () => {
  const { root, mesh } = rig(),
    gate = new RigPoseCulling();
  gate.beginFrame(camera());
  const sphere = mesh.boundingSphere;
  expect(gate.canSkip(root)).toBe(false);
  expect(gate.canSkip(root)).toBe(true);
  (mesh as unknown as { boundingSphere: THREE.Sphere | null }).boundingSphere = null;
  expect(gate.canSkip(root)).toBe(false);
  mesh.boundingSphere = sphere;
  expect(gate.canSkip(root)).toBe(true);
});

test('sleep freezes private bones, preserves render ancestors, and restores authored update flags', () => {
  const { root, mesh } = rig(),
    gate = new RigPoseCulling();
  const moving = new THREE.Bone(),
    manual = new THREE.Bone(),
    ancestor = new THREE.Bone();
  moving.position.x = 2;
  manual.matrixAutoUpdate = false;
  manual.matrixWorldAutoUpdate = false;
  root.add(moving, manual, ancestor);
  ancestor.add(mesh);
  gate.beginFrame(camera());
  gate.canSkip(root);
  gate.setSleeping(root, true);
  expect(moving.matrixAutoUpdate).toBe(false);
  expect(moving.matrixWorldAutoUpdate).toBe(false);
  expect(ancestor.matrixAutoUpdate).toBe(true);
  expect(ancestor.matrixWorldAutoUpdate).toBe(true);
  const frozen = moving.matrixWorld.toArray();
  root.position.x = 60;
  moving.position.x = 4;
  root.updateMatrixWorld(true);
  expect(moving.matrixWorld.toArray()).toEqual(frozen);
  expect(mesh.matrixWorld.elements[12]).toBe(60);
  gate.setSleeping(root, false);
  root.updateMatrixWorld(true);
  expect(moving.matrixWorld.elements[12]).toBe(64);
  expect(moving.matrixAutoUpdate).toBe(true);
  expect(moving.matrixWorldAutoUpdate).toBe(true);
  expect(manual.matrixAutoUpdate).toBe(false);
  expect(manual.matrixWorldAutoUpdate).toBe(false);
});

test('authored shear cannot discard a rig whose transformed envelope reaches the camera', () => {
  const { root } = rig(),
    c = camera(),
    gate = new RigPoseCulling();
  const eigenvalue = (11 + Math.sqrt(117)) / 2;
  const vertex = new THREE.Vector3(3, eigenvalue - 1, 0).normalize();
  const shear = new THREE.Matrix4().set(1, 3, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  const transformed = vertex.clone().applyMatrix4(shear);
  const normal = transformed.clone().normalize();
  c.up.set(-normal.y, normal.x, 0);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  root.matrixAutoUpdate = false;
  root.matrix.copy(shear);
  root.matrix.setPosition(normal.clone().multiplyScalar(2 + transformed.length() - 0.02));
  root.matrixWorldNeedsUpdate = true;
  root.updateWorldMatrix(true, true);
  const corner = vertex.clone().negate().applyMatrix4(root.matrixWorld).project(c);
  expect(Math.abs(corner.x)).toBeLessThan(1);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
  );
  // Maximum column scale alone underbounds this authored transform.
  expect(
    frustum.intersectsSphere(
      new THREE.Sphere(new THREE.Vector3(), 1).applyMatrix4(root.matrixWorld)
    )
  ).toBe(false);
  gate.beginFrame(c);
  expect(gate.canSkip(root)).toBe(false);
  expect(gate.canSkip(root)).toBe(false);
});
