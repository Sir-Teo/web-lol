import * as THREE from 'three';
import { ARRIVAL_GLOWS } from '../content/hawkshot-arrival-glows';
import { arrivalGlows } from './hawkshot-arrival-glow-state';
import { createArrivalGlowQuad } from './hawkshot-glow';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

export class HawkshotArrivalGlows {
  readonly meshes = new Map<string, ReturnType<typeof createArrivalGlowQuad>>();
  private spin = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 0, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, camera: THREE.Camera) {
    const active = new Set<string>();
    for (const area of world.visionAreas) {
      if (
        area.kind !== 'scout' ||
        !area.flight ||
        (area.team !== 'blue' && !world.pointVisible(area))
      )
        continue;
      for (const p of arrivalGlows(area.flight, world.time)) {
        const key = `${area.flight.id}:${p.layer}:${p.birth}`,
          e = ARRIVAL_GLOWS[p.layer];
        active.add(key);
        let mesh = this.meshes.get(key);
        if (!mesh) {
          mesh = createArrivalGlowQuad();
          mesh.name = e.name;
          mesh.material.userData.sourceEmitter = e.name;
          this.scene.add(mesh);
          this.meshes.set(key, mesh);
        }
        mesh.position.set(area.x * 0.01, this.ground(area) + e.offset[1] * 0.01, area.y * 0.01);
        mesh.scale.setScalar(p.size);
        camera
          .getWorldQuaternion(mesh.quaternion)
          .multiply(this.spin.setFromAxisAngle(this.axis, (e.rotation[0] * Math.PI) / 180));
        mesh.material.color.setRGB(p.color[0], p.color[1], p.color[2]);
        mesh.material.opacity = p.alpha;
      }
    }
    for (const [key, mesh] of this.meshes)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.meshes.delete(key);
      }
  }
}
