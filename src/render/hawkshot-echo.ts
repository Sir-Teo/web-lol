import * as THREE from 'three';
import { HAWKSHOT_ECHO } from '../content/hawkshot-echo';
import { createHawkshotEcho, disposeHawkshotEcho } from './hawkshot';
import { echoParticles } from './hawkshot-echo-state';
import type { ScoutFlight } from '../simulation/types';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

export class HawkshotEchoes {
  readonly particles = new Map<
    string,
    { model: ReturnType<typeof createHawkshotEcho>; root: THREE.Group; flightId: number }
  >();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}

  update(world: World): void {
    const active = new Set<string>();
    const retained = new Set<number>();
    const add = (flight: ScoutFlight, team: string) => {
      const particles = echoParticles(flight, world.time);
      if (particles.length) retained.add(flight.id);
      for (const particle of particles) {
        if (team !== 'blue' && !world.pointVisible(particle)) continue;
        const key = `${flight.id}:${particle.index % Math.ceil(HAWKSHOT_ECHO.lifetime * HAWKSHOT_ECHO.rate)}`;
        active.add(key);
        let entry = this.particles.get(key);
        if (!entry) {
          const model = createHawkshotEcho(),
            root = new THREE.Group();
          root.add(model.root);
          this.scene.add(root);
          entry = { model, root, flightId: flight.id };
          this.particles.set(key, entry);
        }
        entry.root.visible = true;
        entry.root.position.set(
          particle.x * 0.01,
          this.ground(particle) + 1.8 + particle.lift,
          particle.y * 0.01
        );
        entry.root.rotation.y = Math.atan2(flight.direction.x, flight.direction.y);
        entry.model.material.opacity = particle.alpha;
        entry.model.mixer.setTime(particle.age);
      }
    };
    for (const p of world.projectiles)
      if (p.type === 'hawkshot')
        add(
          {
            id: p.id,
            origin: p.origin!,
            direction: p.direction,
            speed: p.speed,
            launchTick: p.launchTick!,
          },
          p.team
        );
    for (const area of world.visionAreas)
      if (area.kind === 'scout' && area.flight) add(area.flight, area.team);
    for (const [key, entry] of this.particles)
      if (!active.has(key)) {
        entry.root.visible = false;
        if (retained.has(entry.flightId)) continue;
        this.scene.remove(entry.root);
        disposeHawkshotEcho(entry.model);
        this.particles.delete(key);
      }
  }
}
