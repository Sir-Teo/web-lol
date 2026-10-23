import * as THREE from 'three';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { TICK_RATE } from '../content/rules';
import { LuxESource } from './lux-e-source';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

/** Source static layers reconstructed from the saved gameplay phase. Moving
 * emitters, distortion, hit attachment and native dispatch remain separate work. */
export class LuxSingularities {
  models = new Map<number, THREE.Group>();
  private sources = new Map<number, LuxESource>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private camera: () => THREE.Camera
  ) {}
  update(world: World, alpha: number, terminalAge = 0): void {
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * TICK_RATE : 0);
    const active = new Set<number>();
    for (const zone of world.singularities) {
      if (
        zone.detonatedTick !== null &&
        tick >= zone.detonatedTick + LUX_E_POLICY.presentationSeconds * TICK_RATE
      )
        continue;
      active.add(zone.id);
      let source = this.sources.get(zone.id);
      if (!source) {
        source = new LuxESource(this.camera(), this.ground);
        this.sources.set(zone.id, source);
        this.models.set(zone.id, source.root);
        this.scene.add(source.root);
      }
      source.root.visible = zone.team === 'blue' || world.pointVisible(zone);
      const burst = zone.detonatedTick !== null && tick >= zone.detonatedTick;
      const armed = zone.arrivalTick !== null && tick >= zone.arrivalTick;
      const role = burst ? 'burst' : armed ? (zone.team === 'blue' ? 'ally' : 'enemy') : 'flight';
      const start = burst ? zone.detonatedTick! : armed ? zone.arrivalTick! : zone.launchTick;
      const point = {
        x: zone.previous.x + (zone.x - zone.previous.x) * alpha,
        y: zone.previous.y + (zone.y - zone.previous.y) * alpha,
      };
      source.draw(
        world,
        role,
        zone.id ^ Math.imul(start, 0x9e3779b9),
        (tick - start) / TICK_RATE,
        point,
        zone.origin,
        zone.point,
        zone.team
      );
    }
    for (const [id, source] of this.sources)
      if (!active.has(id)) {
        source.dispose();
        this.sources.delete(id);
        this.models.delete(id);
      }
  }
}
