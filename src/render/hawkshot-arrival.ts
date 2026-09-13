import * as THREE from 'three';
import { HAWKSHOT_ARRIVAL as A } from '../content/hawkshot-arrival';
import { arrivalAurora } from './hawkshot-arrival-state';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let reference: { geometry: THREE.PlaneGeometry; material: THREE.MeshBasicMaterial } | undefined;
export async function loadHawkshotArrival() {
  const map = await new THREE.TextureLoader().loadAsync(
    '/assets/effects/hawkshot-arrival-core.png'
  );
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    color: new THREE.Color().setRGB(
      A.color[0] * A.birthColor[0],
      A.color[1] * A.birthColor[1],
      A.color[2] * A.birthColor[2]
    ),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneFactor;
  material.forceSinglePass = true;
  reference = { geometry: new THREE.PlaneGeometry(1, 1), material };
}

export class HawkshotArrivals {
  readonly bursts = new Map<
    number,
    { root: THREE.Group; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> }
  >();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World) {
    const active = new Set<number>();
    for (const area of world.visionAreas) {
      if (area.kind !== 'scout' || !area.flight) continue;
      const state = arrivalAurora(area.flight, world.time);
      if (!state || (area.team !== 'blue' && !world.pointVisible(area))) continue;
      const id = area.flight.id;
      active.add(id);
      let burst = this.bursts.get(id);
      if (!burst) {
        if (!reference) throw new Error('Hawkshot arrival texture is not loaded');
        const root = new THREE.Group(),
          mesh = new THREE.Mesh(reference.geometry, reference.material.clone());
        mesh.name = 'Hawkshot endpoint Aurora';
        mesh.rotation.set(
          ...(A.rotation.map(THREE.MathUtils.degToRad) as [number, number, number])
        );
        mesh.scale.set(A.scale[0] * 0.01, A.scale[1] * 0.01, 1);
        mesh.renderOrder = A.renderOrder;
        root.add(mesh);
        this.scene.add(root);
        burst = { root, mesh };
        this.bursts.set(id, burst);
      }
      burst.root.position.set(area.x * 0.01, this.ground(area) + state.lift, area.y * 0.01);
      // Endpoint placement uses world axes; incoming-flight yaw is not authored here.
      burst.mesh.material.opacity = state.alpha;
    }
    for (const [id, burst] of this.bursts)
      if (!active.has(id)) {
        this.scene.remove(burst.root);
        burst.mesh.material.dispose();
        this.bursts.delete(id);
      }
  }
}
