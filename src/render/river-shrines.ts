import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { RiverSide } from '../content/scuttler-policy';
import { SCUTTLER_POLICY } from '../content/scuttler-policy';
import { shrinePoint } from '../simulation/scuttler';
import { SCALE } from './terrain';
import type { Vec2 } from '../simulation/math';
/** Local readable area marker; native shrine particles/model remain unfinished. */
export class RiverShrines {
  private geometry = new THREE.RingGeometry(
    SCUTTLER_POLICY.shrineSpeedRadius * SCALE * 0.9,
    SCUTTLER_POLICY.shrineSpeedRadius * SCALE,
    64
  );
  private meshes = new Map<RiverSide, THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>();
  constructor(private scene: THREE.Scene) {}
  update(w: World, ground: (p: Vec2) => number): void {
    const active = new Set<RiverSide>();
    for (const shrine of w.scuttlers?.shrines ?? []) {
      if (shrine.endTick <= w.tick) continue;
      active.add(shrine.river);
      let mesh = this.meshes.get(shrine.river);
      if (!mesh) {
        mesh = new THREE.Mesh(
          this.geometry,
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        mesh.rotation.x = -Math.PI / 2;
        this.meshes.set(shrine.river, mesh);
        this.scene.add(mesh);
      }
      const point = shrinePoint(shrine.river, w.battlefield);
      mesh.position.set(point.x * SCALE, ground(point) + 0.05, point.y * SCALE);
      mesh.material.color.setHex(shrine.team === w.hero.team ? 0x6ed6d4 : 0xe89575);
      mesh.visible = w.pointVisible(point);
    }
    for (const [side, mesh] of this.meshes)
      if (!active.has(side)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.meshes.delete(side);
      }
  }
}
