import * as THREE from 'three';
import { HAWKSHOT_GLOW } from '../content/hawkshot-glow';

let reference: { geometry: THREE.PlaneGeometry; materials: THREE.MeshBasicMaterial[] } | undefined;

export async function loadHawkshotGlow(): Promise<void> {
  const map = await new THREE.TextureLoader().loadAsync('/assets/effects/hawkshot-glow.png');
  map.colorSpace = THREE.SRGBColorSpace;
  const materials = HAWKSHOT_GLOW.map((layer) => {
    const material = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color().setRGB(...(layer.color.slice(0, 3) as [number, number, number])),
      opacity: layer.color[3],
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.forceSinglePass = true;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = layer.blendMode === 4 ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    material.userData.sourceEmitter = layer.name;
    return material;
  });
  reference = { geometry: new THREE.PlaneGeometry(1, 1), materials };
}

/** Emitter-bound XY quads; uniform-scale X and absent atlas division follow the documented adapter policy. */
export function createHawkshotGlow(): THREE.Group {
  if (!reference) throw new Error('Hawkshot glow is not loaded');
  const root = new THREE.Group();
  root.name = 'Hawkshot source background';
  HAWKSHOT_GLOW.forEach((layer, index) => {
    const mesh = new THREE.Mesh(reference!.geometry, reference!.materials[index]);
    mesh.name = layer.name;
    mesh.position.fromArray(layer.offset).multiplyScalar(0.01);
    mesh.scale.setScalar(layer.birthScale[0] * layer.scale[0] * 0.01);
    mesh.renderOrder = layer.renderOrder;
    mesh.frustumCulled = false;
    root.add(mesh);
  });
  animateHawkshotGlow(root, 0);
  return root;
}

export function animateHawkshotGlow(root: THREE.Group, seconds: number): void {
  root.children.forEach((mesh, index) => {
    const layer = HAWKSHOT_GLOW[index];
    mesh.visible = seconds >= layer.delay && seconds < layer.delay + layer.lifetime;
  });
}
