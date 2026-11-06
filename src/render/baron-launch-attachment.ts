import * as THREE from 'three';
import { BARON } from '../content/baron';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import { validPoseFrame } from '../simulation/pose-history';
import type { LuxImpactFrame } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import type { TargetPoseSampler } from './target-pose-sampler';

/** Samples the authored launch joint from an owned historical body pose.
 * Reference-model scale is already included by the private skeleton. Placement
 * adds only saved facing, map coordinates and terrain height; missile height
 * routing and particle-space conversion remain separate policies. */
export class BaronLaunchAttachment {
  private cache = new WeakMap<LuxImpactFrame, THREE.Matrix4>();
  private disposed = false;
  constructor(
    private readonly sampler: TargetPoseSampler,
    private readonly ground: (point: Vec2) => number
  ) {}
  matrix(pose: LuxImpactFrame): THREE.Matrix4 {
    if (this.disposed) throw Error('Baron launch attachment has been disposed');
    const cached = this.cache.get(pose);
    if (cached) return cached.clone();
    if (
      ![pose.x, pose.y, pose.facing].every(Number.isFinite) ||
      pose.animationTimeline?.primary.kind !== 'attack' ||
      !validPoseFrame(pose, 'sru-baron-base', true)
    )
      throw Error('Invalid historical Baron release pose');
    const height = this.ground(pose);
    if (!Number.isFinite(height)) throw Error('Invalid Baron launch terrain height');
    const timeline = pose.animationTimeline;
    this.sampler.sample(
      animationLayers(timeline, timeline.tick, MOBILE_CLIP_DURATIONS['sru-baron-base'])
    );
    const local = new THREE.Matrix4();
    if (!this.sampler.boneMatrix(BARON.basicAttack.startBone, local))
      throw Error('Baron source rig lacks its authored launch joint');
    const placed = new THREE.Matrix4().makeRotationY(pose.facing);
    placed.setPosition(pose.x * 0.01, height, pose.y * 0.01);
    placed.multiply(local);
    this.cache.set(pose, placed);
    return placed.clone();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sampler.dispose();
    this.cache = new WeakMap();
  }
}
