import { LUX_E_HIT_SECONDS } from '../content/lux-e-hit';
import { luxEHitPoint } from './lux-e-hit-point';
import * as THREE from 'three';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { TICK_RATE } from '../content/rules';
import { LuxESource } from './lux-e-source';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

/** Source static layers and field/detonation motion reconstruct from the saved phase.
 * Source hit flashes use saved target-root translation; native anchors and distortion remain open. */
export class LuxSingularities {
  models = new Map<number, THREE.Group>();
  readonly hitModels = new Map<string, THREE.Group>();
  private hitSources = new Map<string, LuxESource>();
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
      if (source.root.visible)
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
      else source.hide();
    }
    const activeHits = new Set<string>();
    for (const zone of world.singularities)
      for (const hit of zone.hits) {
        const age = (tick - zone.detonatedTick!) / TICK_RATE;
        if (!hit.audience.includes('blue') || age < 0 || age >= LUX_E_HIT_SECONDS) continue;
        const key = `${zone.id}:${hit.targetId}`;
        let source = this.hitSources.get(key);
        if (!source) {
          source = new LuxESource(this.camera(), this.ground);
          this.hitSources.set(key, source);
          this.hitModels.set(key, source.root);
          this.scene.add(source.root);
        }
        const point = luxEHitPoint(hit, tick),
          target = world.unit(hit.targetId);
        source.root.visible =
          world.pointVisible(point) &&
          (hit.detachedTick !== null || !target || world.visible(target, 'blue'));
        if (source.root.visible)
          source.draw(
            world,
            'hit',
            zone.id ^
              Math.imul(hit.targetId, 0x85ebca6b) ^
              Math.imul(zone.detonatedTick!, 0x9e3779b9),
            age,
            point,
            zone.origin,
            zone.point,
            hit.targetTeam
          );
        else source.hide();
        activeHits.add(key);
      }
    for (const [key, source] of this.hitSources)
      if (!activeHits.has(key)) {
        source.dispose();
        this.hitSources.delete(key);
        this.hitModels.delete(key);
      }
    for (const [id, source] of this.sources)
      if (!active.has(id)) {
        source.dispose();
        this.sources.delete(id);
        this.models.delete(id);
      }
  }
}
