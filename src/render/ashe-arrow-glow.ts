import * as THREE from 'three';
import { ASHE_ARROW_GLOW } from '../content/ashe-arrow-glow';

export function arrowGlowColor(empowered: boolean, layer: number, age: number): number[] {
  const e = ASHE_ARROW_GLOW[empowered ? 'focus' : 'basic'][layer];
  if (!Number.isFinite(age) || age < 0 || age >= e.life) return [0, 0, 0, 0];
  const t = age / e.life;
  const b = e.times.findIndex((time) => time >= t);
  const a = Math.max(0, b - 1);
  const mix = a === b ? 0 : (t - e.times[a]) / (e.times[b] - e.times[a]);
  return e.colors[a].map((value, i) => value + (e.colors[b][i] - value) * mix);
}

let map: THREE.Texture;
const geometry = new THREE.PlaneGeometry(1, 1);
export async function loadArrowGlow(): Promise<void> {
  map = await new THREE.TextureLoader().loadAsync('assets/effects/ashe-arrow-glow.png');
  map.colorSpace = THREE.SRGBColorSpace;
}

export function createArrowGlow(empowered: boolean): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Source arrow glow';
  ASHE_ARROW_GLOW[empowered ? 'focus' : 'basic'].forEach((e) => {
    const material = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.forceSinglePass = true;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneFactor;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = e.name;
    // Adapt emitter XY to the projectile's ground-parallel XZ frame.
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(e.offset[0] * 0.01, e.offset[2] * 0.01, e.offset[1] * 0.01);
    mesh.scale.set(e.size[0] * 0.01, e.size[1] * 0.01, 1);
    root.add(mesh);
  });
  animateArrowGlow(root, empowered, 0);
  return root;
}
export function animateArrowGlow(root: THREE.Group, empowered: boolean, age: number): void {
  root.children.forEach((child, i) => {
    const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    const color = arrowGlowColor(empowered, i, age);
    mesh.visible = color[3] > 0;
    mesh.material.color.setRGB(color[0], color[1], color[2]);
    mesh.material.opacity = color[3];
  });
}
export function disposeArrowGlow(root: THREE.Group): void {
  for (const child of root.children)
    (child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.dispose();
}
