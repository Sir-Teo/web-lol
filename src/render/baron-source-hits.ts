import * as THREE from 'three';
import { BARON_ATTACK_HIT_HISTORY_TICKS } from '../content/baron-attack-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { BaronAttackContact } from '../simulation/baron-attack-visuals';
import { createTargetPoseSampler } from './models';
import { BaronContactAttachment } from './baron-contact-attachment';
import { BaronHistoryPlayback } from './baron-history-playback';
import { BaronParticleBatch } from './baron-particle-batch';
import type { BaronParticleResources } from './baron-particle-resources';

interface HitCloud {
  contact: BaronAttackContact;
  attachment: BaronContactAttachment;
  playback: BaronHistoryPlayback;
  batch: BaronParticleBatch;
}
/** Source-hit preview for the private encounter. Neutral bound-size factors match
 * the external reader; native bound-object scaling remains uncertified. Body
 * attachment uses the saved authored chest joint, never the later live target. */
export class BaronSourceHits {
  readonly clouds = new Map<number, HitCloud>();
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
    cloud.attachment.dispose();
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
      const contact = effect.impact;
      if (
        !contact?.targetRig ||
        tick < contact.startTick ||
        tick - contact.startTick >= BARON_ATTACK_HIT_HISTORY_TICKS
      )
        continue;
      active.add(effect.id);
      let cloud = this.clouds.get(effect.id);
      if (cloud && cloud.contact !== contact) {
        this.retire(effect.id);
        cloud = undefined;
      }
      if (!cloud) {
        const attachment = new BaronContactAttachment(
          contact.targetRig,
          createTargetPoseSampler(contact.targetRig),
          this.ground
        );
        try {
          cloud = {
            contact,
            attachment,
            playback: new BaronHistoryPlayback(
              this.resources.program,
              'hit',
              Math.imul(effect.id + 1, 0x9e3779b9) >>> 0,
              contact.startTick,
              { capacity: 512, birthFactors: () => ({ birthScale: 1, emitOffset: 1 }) }
            ),
            batch: new BaronParticleBatch(this.resources, 'hit'),
          };
          this.scene.add(cloud.batch.root);
          this.clouds.set(effect.id, cloud);
        } catch (error) {
          attachment.dispose();
          throw error;
        }
      }
      const attachment = cloud.attachment,
        last = contact.frames.at(-1)!;
      const output = cloud.playback.sample(tick, (at) => {
        // A terminal match can outlive its frozen saved history; freeze that
        // exact final root rather than sampling a future target or audience.
        const retained = Math.min(at, last.tick),
          matrix = attachment.matrix(contact, retained),
          rotation = new THREE.Matrix4().extractRotation(matrix),
          e = rotation.elements;
        const index = Math.floor(retained) - contact.startTick,
          frame = contact.frames[index];
        if (!frame) throw Error('Baron contact lacks historical visibility');
        return {
          origin: [matrix.elements[12] * 100, matrix.elements[13] * 100, matrix.elements[14] * 100],
          orientation: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]],
          visible: frame.audience.includes(team),
          stopped: false,
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
