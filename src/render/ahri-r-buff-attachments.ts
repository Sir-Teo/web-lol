import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import { rBuffVisualPose, type RBuffVisualGroup } from './ahri-r-persistent-history';
import { AHRI_R_VISUAL_POSE_TICKS } from '../content/ahri-r-visual-timing';

/** Private saved Ahri poses resolve the exact source eye/layout bone names.
 * Missing bones use an explicitly reported collision-height fallback. */
export class RBuffAttachmentRoots {
  private world?: World;
  private actors = new Map<number, { root: THREE.Group; sampler: TargetPoseSampler }>();
  private points = new Map<
    string,
    { group: string; actor: number; at: number; position: THREE.Vector3 }
  >();
  private fallback = new Set<string>();
  constructor(
    private ground: (point: Vec2) => number,
    private create: (rig: MobileRig) => TargetPoseSampler = createTargetPoseSampler
  ) {}
  begin(world: World) {
    if (this.world !== world) {
      this.dispose();
      this.world = world;
    } else
      for (const [key, point] of this.points)
        if (point.at >= world.tick - 1 || point.at < world.tick - AHRI_R_VISUAL_POSE_TICKS)
          this.points.delete(key);
  }
  get localFallbacks() {
    return [...this.fallback].sort();
  }
  get samplerCount() {
    return this.actors.size;
  }
  get cachedPointCount() {
    return this.points.size;
  }
  position(group: RBuffVisualGroup, tick: number): THREE.Vector3 | null {
    if (!this.world) throw Error('R buff attachment roots require a World');
    if (!Number.isFinite(tick)) return null;
    const at = Math.min(tick, this.world.tick, group.record.sourceEnd?.tick ?? Infinity);
    const pose = rBuffVisualPose(group, at);
    if (!pose) return null;
    const key = `${group.key}:${at}:${group.bone}`,
      old = this.points.get(key);
    if (old) return old.position.clone();
    const point = new THREE.Vector3();
    let native = false;
    if (pose.animationTimeline) {
      let actor = this.actors.get(group.record.sourceId);
      if (!actor) {
        const sampler = this.create('ahri-base'),
          root = new THREE.Group();
        root.add(sampler.renderRoot);
        actor = { root, sampler };
        this.actors.set(group.record.sourceId, actor);
      }
      actor.root.position.set(pose.x * 0.01, this.ground(pose), pose.y * 0.01);
      actor.root.rotation.y = pose.facing;
      actor.sampler.sample(
        animationLayers(pose.animationTimeline, at, MOBILE_CLIP_DURATIONS['ahri-base'])
      );
      actor.root.updateMatrixWorld(true);
      native = actor.sampler.bonePosition(group.bone, point);
    }
    if (native)
      point.set(
        Math.fround(point.x * 100) * 0.01,
        Math.fround(point.y * 100) * 0.01,
        Math.fround(point.z * 100) * 0.01
      );
    else {
      point.set(pose.x * 0.01, this.ground(pose) + pose.radius * 0.015, pose.y * 0.01);
      this.fallback.add(`${group.key}:${group.bone}`);
    }
    this.points.set(key, { group: group.key, actor: group.record.sourceId, at, position: point });
    return point.clone();
  }
  retain(groups: ReadonlySet<string>) {
    const actors = new Set<number>();
    for (const [key, point] of this.points) {
      if (!groups.has(point.group)) this.points.delete(key);
      else actors.add(point.actor);
    }
    for (const [id, actor] of this.actors)
      if (!actors.has(id)) {
        actor.sampler.dispose();
        actor.root.clear();
        this.actors.delete(id);
      }
    for (const key of this.fallback)
      if (![...groups].some((group) => key.startsWith(group + ':'))) this.fallback.delete(key);
  }
  dispose() {
    for (const actor of this.actors.values()) {
      actor.sampler.dispose();
      actor.root.clear();
    }
    this.actors.clear();
    this.points.clear();
    this.fallback.clear();
    this.world = undefined;
  }
}
