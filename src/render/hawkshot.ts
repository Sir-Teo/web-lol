import * as THREE from 'three';

/** Readable flight proxy pending conversion of the authored Hawkshot particles. */
export function createHawkshot(): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xb9f5ff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.65, 4), material);
  body.rotation.x = Math.PI / 2;
  root.add(body);
  for (const side of [-1, 1]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0.12, side * 0.7, 0, -0.12, side * 0.95, 0, -0.5, side * 0.5, 0, -0.34, 0, 0, -0.2],
        3
      )
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
    const wing = new THREE.Mesh(geometry, material);
    wing.name = side < 0 ? 'left-wing' : 'right-wing';
    root.add(wing);
  }
  return root;
}

export function animateHawkshot(root: THREE.Group, seconds: number): void {
  const flap = Math.sin(seconds * 12) * 0.25;
  root.getObjectByName('left-wing')!.rotation.z = flap;
  root.getObjectByName('right-wing')!.rotation.z = -flap;
}
