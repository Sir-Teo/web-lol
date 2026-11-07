import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { MobileRig } from '../content/mobile-clip-durations';
import type { TargetPoseSampler } from './target-pose-sampler';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { SourceParticleSurfaces } from './source-particle-surfaces';
import {
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
  AHRI_R_PROFILES,
} from './ahri-r-particles';
import { ahriRAssets } from './ahri-r-assets';
import { RBuffAttachmentRoots } from './ahri-r-buff-attachments';
import {
  rBuffVisualGroups,
  rBuffVisualKnown,
  rBuffVisualPose,
  type RBuffVisualGroup,
} from './ahri-r-persistent-history';
import type { AhriRVisualHistory } from '../simulation/ahri-r-visual-history';

interface Resources extends EclipseSurfaceAssets {
  sampler(rig: MobileRig): TargetPoseSampler;
}
interface Held {
  record: AhriRVisualHistory;
  sampler: AhriRParticleSampler;
  particles: ReturnType<AhriRParticleSampler['sample']>;
}
/** Two source eye-glow profiles attach to both explicit eye bones. Trails,
 * layout effects and unresolved counter drivers remain deferred. */
export class AhriRBuffParticles {
  readonly surfaces: SourceParticleSurfaces<RBuffVisualGroup>;
  private roots: RBuffAttachmentRoots;
  private groups: RBuffVisualGroup[] = [];
  private held = new Map<string, Held>();
  private world?: World;
  private lastTick = -1;
  get attachmentFallbacks() {
    return this.roots.localFallbacks;
  }
  constructor(
    scene: THREE.Scene,
    distortion: THREE.Scene,
    ground: (point: Vec2) => number,
    private supplied?: Resources
  ) {
    this.roots = new RBuffAttachmentRoots(
      ground,
      supplied ? (rig) => supplied.sampler(rig) : undefined
    );
    this.surfaces = new SourceParticleSurfaces(scene, distortion, ground, {
      name: 'Ahri R skin buff',
      attachment: 'saved-R-buff-eye-root',
      profiles: AHRI_R_PROFILES.map((p) => ({
        ...p,
        uvMode: 0,
        directionVelocityScale: p.directionVelocityScale ?? 0,
        soft: null,
      })),
      assets: () => this.supplied ?? ahriRAssets(),
      accepts: (index) => AHRI_R_BOUND_BUFF_PROFILES.some((selected) => selected === index),
      records: () =>
        this.groups.map((group) => ({
          sourceId: group.record.sourceId,
          castTick: group.startTick,
          group,
        })),
      particles: (group) => this.held.get(group.key)?.particles ?? [],
      birthVisible: () => true,
      visible: (group, _particle, tick, position) => {
        const world = this.world!,
          team = world.hero.team;
        return (
          group.record.team === team ||
          (rBuffVisualKnown(group, Math.min(tick, world.tick), team) &&
            world.pointVisible({ x: position.x * 100, y: position.z * 100 }, team))
        );
      },
      pose: (group, tick) => {
        const pose = rBuffVisualPose(group, tick),
          point = this.roots.position(group, tick);
        return pose && point ? { x: point.x * 100, y: point.z * 100, facing: pose.facing } : null;
      },
      attachmentPoint: (group, tick) => this.roots.position(group, tick),
      particleFacing: (profile, born, current) => (profile.particleLocal ? current : born),
      sampledStretch: true,
    });
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.world !== world || world.tick < this.lastTick) {
      this.surfaces.dispose();
      for (const held of this.held.values()) held.sampler.dispose();
      this.held.clear();
      this.roots.dispose();
    }
    this.world = world;
    this.lastTick = world.tick;
    this.roots.begin(world);
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0),
      keep = new Set<string>();
    this.groups = [];
    if (this.supplied ?? ahriRAssets())
      for (const record of world.ahriRVisuals)
        for (const group of rBuffVisualGroups(record)) {
          if (
            group.system !== 'Ahri_R_Eyes' ||
            tick < group.startTick ||
            tick >= Math.min(group.stopTick, group.startTick + 50 * 60) + 2 * 60
          )
            continue;
          keep.add(group.key);
          let held = this.held.get(group.key);
          if (!held || held.record !== record) {
            held?.sampler.dispose();
            held = {
              record,
              sampler: new AhriRParticleSampler('Ahri_R_Eyes', group.seed, {
                boundObjectSize: group.radius * 2,
                root: (time) => {
                  const at = group.startTick + time * 60,
                    pose = rBuffVisualPose(group, at),
                    point = this.roots.position(group, at);
                  if (!pose || !point)
                    throw Error('R eye birth requires an owned caster observation');
                  return {
                    x: point.x * 100,
                    y: point.z * 100,
                    height: point.y * 100,
                    facing: pose.facing,
                  };
                },
              }),
              particles: [],
            };
            this.held.set(group.key, held);
          }
          held.particles = held.sampler.sample(
            (tick - group.startTick) / 60,
            (group.stopTick - group.startTick) / 60
          );
          this.groups.push(group);
        }
    this.surfaces.update(world, alpha, camera, terminalAge);
    this.roots.retain(keep);
    for (const [key, held] of this.held)
      if (!keep.has(key)) {
        held.sampler.dispose();
        this.held.delete(key);
      }
  }
  dispose() {
    this.surfaces.dispose();
    for (const held of this.held.values()) held.sampler.dispose();
    this.held.clear();
    this.groups = [];
    this.roots.dispose();
    this.world = undefined;
    this.lastTick = -1;
  }
}
