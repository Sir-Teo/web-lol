import * as THREE from 'three';
import { BARON } from '../content/baron';
import { BARON_ATTACK_FLIGHT_TAIL_TICKS } from '../content/baron-attack-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { BaronAttackVisual } from '../simulation/baron-attack-visuals';
import { createTargetPoseSampler } from './models';
import { BaronLaunchAttachment } from './baron-launch-attachment';
import { BaronFlightProjection } from './baron-flight-projection';
import { BaronHistoryPlayback } from './baron-history-playback';
import { BaronParticleBatch } from './baron-particle-batch';
import type { BaronParticleResources } from './baron-particle-resources';
interface FlightCloud {
  effect: BaronAttackVisual;
  launchMatrix: THREE.Matrix4;
  projection: BaronFlightProjection;
  playback: BaronHistoryPlayback;
  batch: BaronParticleBatch;
}
/** Source missile preview with the explicitly local single-elevation projection.
 * The source offsetInitialTargetHeight remains preserved, not silently added to
 * targetHeightAugment. Their native routing is not certified by this preview. */
export class BaronSourceFlights {
  readonly clouds = new Map<number, FlightCloud>();
  private world: World | undefined;
  private closed = false;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly ground: (point: Vec2) => number,
    private readonly resources: BaronParticleResources
  ) {}
  private retire(id: number) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    cloud.batch.dispose();
    this.clouds.delete(id);
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.closed) return;
    if (this.world !== world) {
      for (const id of this.clouds.keys()) this.retire(id);
      this.world = world;
    }
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0),
      active = new Set<number>(),
      team = world.hero.team;
    for (const effect of world.baronAttackVisuals) {
      if (
        tick < effect.launchTick ||
        (effect.stopTick !== null && tick >= effect.stopTick + BARON_ATTACK_FLIGHT_TAIL_TICKS)
      )
        continue;
      active.add(effect.id);
      let cloud = this.clouds.get(effect.id);
      if (cloud && cloud.effect !== effect) {
        this.retire(effect.id);
        cloud = undefined;
      }
      if (!cloud) {
        const attachment = new BaronLaunchAttachment(
          createTargetPoseSampler('sru-baron-base'),
          this.ground
        );
        let launchMatrix: THREE.Matrix4;
        try {
          launchMatrix = attachment.matrix(effect.launchPose);
        } finally {
          attachment.dispose();
        }
        cloud = {
          effect,
          launchMatrix,
          projection: new BaronFlightProjection(
            effect,
            launchMatrix,
            effect.initialTargetPoint,
            this.ground,
            BARON.basicAttack.targetHeightAugment
          ),
          playback: new BaronHistoryPlayback(
            this.resources.program,
            'missile',
            Math.imul(effect.id + 1, 0x85ebca6b) >>> 0,
            effect.launchTick,
            { capacity: 512 }
          ),
          batch: new BaronParticleBatch(this.resources, 'missile'),
        };
        this.scene.add(cloud.batch.root);
        this.clouds.set(effect.id, cloud);
      }
      const projection = cloud.projection,
        last = effect.frames.at(-1)!;
      const output = cloud.playback.sample(tick, (at) => {
        const retained = Math.min(at, last.tick),
          root = projection.sample(retained),
          frame = effect.frames[Math.floor(retained) - effect.launchTick];
        if (!frame) throw Error('Baron missile lacks historical audience');
        return {
          ...root,
          visible: frame.audience.includes(team),
          stopped: effect.stopTick !== null && at >= effect.stopTick,
        };
      });
      cloud.batch.update(
        output.packets,
        camera,
        (packet) =>
          output.bornVisible.has(packet.serial) &&
          world.pointVisible({ x: packet.position[0], y: packet.position[2] }, team)
      );
    }
    for (const id of this.clouds.keys()) if (!active.has(id)) this.retire(id);
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const id of this.clouds.keys()) this.retire(id);
    this.resources.dispose();
    this.world = undefined;
  }
}
