import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { mobileRig, MOBILE_CLIP_DURATIONS, type MobileRig } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import { eVisualPose, type EVisualGroup } from './ahri-e-history';

export function eVisualAttachment(group: EVisualGroup): string {
  if (group.role === 'cast') return 'C_Buffbone_Glb_Center_Loc';
  if (group.role === 'flight') return 'saved-missile-root';
  if (group.role === 'hit') return 'spine';
  return group.system === 'Ahri_E_buf' ? 'C_BUFFBONE_GLB_HEAD_LOC' : 'C_BUFFBONE_GLB_LAYOUT_LOC';
}
interface Held {
  root: THREE.Group;
  sampler: TargetPoseSampler;
}
interface Point {
  groupKey: string;
  unitId: number | undefined;
  position: THREE.Vector3;
  native: boolean;
  at: number;
}
/** Private historical poses never advance a live model. Missing bones/rigs use
 * named local collision-height adapters, not invented native bone aliases. */
export class EAttachmentRoots {
  private world?: World;
  private actors = new Map<number, Held>();
  private points = new Map<string, Point>();
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
        if (point.at >= world.tick - 1) this.points.delete(key);
  }
  get localFallbacks() {
    return [...this.fallback].sort();
  }
  get samplerCount() {
    return this.actors.size;
  }
  position(group: EVisualGroup, tick: number): THREE.Vector3 | null {
    const world = this.world;
    if (!world) throw Error('E attachment roots require a World');
    if (!Number.isFinite(tick)) return null;
    const frames = group.role === 'cast' ? group.record.sourceFrames : group.record.targetFrames;
    const at =
      group.role === 'flight'
        ? Math.min(tick, world.tick)
        : Math.min(tick, world.tick, frames.at(-1)!.tick);
    const pose = eVisualPose(group, at);
    if (!pose) return null;
    const bone = eVisualAttachment(group),
      key = group.key + ':' + at + ':' + bone;
    const old = this.points.get(key);
    if (old) return old.position.clone();
    const unitId =
      group.role === 'flight'
        ? undefined
        : group.role === 'cast'
          ? group.record.sourceId
          : group.record.hit?.targetId;
    const unit = unitId === undefined ? undefined : world.unit(unitId);
    const rig = unit && mobileRig(unit);
    const point = new THREE.Vector3();
    let native = false;
    if (group.role !== 'flight' && unit && rig) {
      let held = this.actors.get(unit.id);
      if (!held) {
        const sampler = this.create(rig),
          root = new THREE.Group();
        root.add(sampler.renderRoot);
        held = { root, sampler };
        this.actors.set(unit.id, held);
      }
      held.root.position.set(pose.x * 0.01, this.ground(pose), pose.y * 0.01);
      held.root.rotation.y = pose.facing;
      held.sampler.sample(
        unit.animationTimeline
          ? animationLayers(unit.animationTimeline, at, MOBILE_CLIP_DURATIONS[rig])
          : []
      );
      held.root.updateMatrixWorld(true);
      native = held.sampler.bonePosition(bone, point);
    }
    if (!native) {
      const height =
        group.role === 'flight'
          ? 1
          : bone === 'C_BUFFBONE_GLB_LAYOUT_LOC'
            ? 0
            : bone === 'C_BUFFBONE_GLB_HEAD_LOC'
              ? pose.radius * 0.02
              : pose.radius * 0.015;
      point.set(pose.x * 0.01, this.ground(pose) + height, pose.y * 0.01);
      if (group.role !== 'flight') this.fallback.add(group.key + ':' + bone);
    }
    this.points.set(key, { groupKey: group.key, unitId, position: point, native, at });
    return point.clone();
  }
  retain(groups: ReadonlySet<string>) {
    const units = new Set<number>();
    for (const [key, point] of this.points) {
      if (!groups.has(point.groupKey)) this.points.delete(key);
      else if (point.unitId !== undefined) units.add(point.unitId);
    }
    for (const [id, held] of this.actors)
      if (!units.has(id)) {
        held.sampler.dispose();
        held.root.clear();
        this.actors.delete(id);
      }
    for (const key of this.fallback)
      if (![...groups].some((g) => key.startsWith(g + ':'))) this.fallback.delete(key);
  }
  dispose() {
    for (const held of this.actors.values()) {
      held.sampler.dispose();
      held.root.clear();
    }
    this.actors.clear();
    this.points.clear();
    this.fallback.clear();
    this.world = undefined;
  }
}
