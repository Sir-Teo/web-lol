import * as THREE from 'three';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { TICK_RATE } from '../content/rules';
import { SCALE } from './terrain';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

/** Temporary readable lifecycle view; native E particle extraction remains pending. */
export class LuxSingularities {
  models = new Map<number, THREE.Group>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number): void {
    const active = new Set<number>();
    for (const zone of world.singularities) {
      active.add(zone.id);
      let group = this.models.get(zone.id);
      if (!group) {
        group = new THREE.Group();
        const color = zone.team === 'blue' ? 0x8adbff : 0xff818d;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true })
        );
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color, transparent: true })
        );
        const positions = new Float32Array(64 * 3);
        for (let i = 0; i < 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          const p = {
            x: zone.point.x + Math.cos(angle) * LUX_E_POLICY.radius,
            y: zone.point.y + Math.sin(angle) * LUX_E_POLICY.radius,
          };
          positions.set([p.x * SCALE, this.ground(p) + 0.12, p.y * SCALE], i * 3);
        }
        ring.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        ring.geometry.computeBoundingSphere();
        group.add(orb, ring);
        this.models.set(zone.id, group);
        this.scene.add(group);
      }
      group.visible = zone.team === 'blue' || world.pointVisible(zone);
      const point = {
        x: zone.previous.x + (zone.x - zone.previous.x) * alpha,
        y: zone.previous.y + (zone.y - zone.previous.y) * alpha,
      };
      const orb = group.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      const ring = group.children[1] as THREE.LineLoop<
        THREE.BufferGeometry,
        THREE.LineBasicMaterial
      >;
      const burst =
        zone.detonatedTick === null
          ? 0
          : Math.max(
              0,
              (world.tick - zone.detonatedTick + alpha - 1) /
                (LUX_E_POLICY.presentationSeconds * TICK_RATE)
            );
      orb.position.set(point.x * SCALE, this.ground(point) + 0.7, point.y * SCALE);
      orb.scale.setScalar(zone.detonatedTick === null ? 1 : 1 + burst * 5);
      orb.material.opacity = 1 - burst;
      ring.visible = zone.arrivalTick !== null;
      ring.material.opacity = 1 - burst;
    }
    for (const [id, group] of this.models)
      if (!active.has(id)) {
        this.scene.remove(group);
        for (const child of group.children) {
          const drawable = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
          drawable.geometry.dispose();
          drawable.material.dispose();
        }
        this.models.delete(id);
      }
  }
}
