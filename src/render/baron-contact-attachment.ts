import * as THREE from 'three';
import { BARON } from '../content/baron';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../content/mobile-clip-durations';
import type { ImpactRig } from '../content/impact-target';
import type { BaronAttackContact } from '../simulation/baron-attack-visuals';
import { animationLayers } from '../simulation/animation-timeline';
import { validPoseFrame } from '../simulation/pose-history';
import type { Vec2 } from '../simulation/math';
import type { TargetPoseSampler } from './target-pose-sampler';

/** Saved chest-bone matrices, including the reference rig's authored scale.
 * Native particle unit/size calibration is separate from this exact body pose. */
export class BaronContactAttachment {
  private cache = new WeakMap<BaronAttackContact['frames'][number], THREE.Matrix4>();
  private closed = false;
  constructor(
    private readonly rig: ImpactRig,
    private readonly sampler: TargetPoseSampler,
    private readonly ground: (point: Vec2) => number
  ) {}
  private endpoint(contact: BaronAttackContact, frame: BaronAttackContact['frames'][number]) {
    const cached = this.cache.get(frame);
    if (cached) return cached;
    const attached = contact.detachedTick === null || frame.tick < contact.detachedTick;
    if (
      contact.targetRig !== this.rig ||
      !validPoseFrame(frame, this.rig, attached) ||
      !frame.animationTimeline ||
      ![frame.x, frame.y, frame.facing].every(Number.isFinite)
    )
      throw Error('Invalid Baron contact pose');
    const height = this.ground(frame);
    if (!Number.isFinite(height)) throw Error('Invalid Baron contact terrain');
    const timeline = frame.animationTimeline;
    this.sampler.sample(
      animationLayers(timeline, timeline.tick, MOBILE_CLIP_DURATIONS[this.rig as MobileRig])
    );
    const local = new THREE.Matrix4();
    if (!this.sampler.boneMatrix(BARON.basicAttack.hitBone, local))
      throw Error('Target rig lacks Baron authored contact joint');
    const placed = new THREE.Matrix4()
      .makeRotationY(frame.facing)
      .setPosition(frame.x * 0.01, height, frame.y * 0.01)
      .multiply(local);
    this.cache.set(frame, placed);
    return placed;
  }
  matrix(contact: BaronAttackContact, tick: number) {
    if (this.closed) throw Error('Baron contact attachment is disposed');
    const first = contact.frames[0],
      last = contact.frames.at(-1);
    if (!Number.isFinite(tick) || !first || !last || tick < first.tick || tick > last.tick)
      throw RangeError('Baron contact lacks retained pose');
    const index = Math.floor(tick) - first.tick,
      a = contact.frames[index],
      b = contact.frames[index + 1];
    if (!a) throw Error('Baron contact pose history has a gap');
    const from = this.endpoint(contact, a);
    if (!b || tick === a.tick) return from.clone();
    const to = this.endpoint(contact, b),
      position = new THREE.Vector3(),
      rotation = new THREE.Quaternion(),
      scale = new THREE.Vector3(),
      nextPosition = new THREE.Vector3(),
      nextRotation = new THREE.Quaternion(),
      nextScale = new THREE.Vector3();
    from.decompose(position, rotation, scale);
    to.decompose(nextPosition, nextRotation, nextScale);
    const alpha = tick - a.tick;
    return new THREE.Matrix4().compose(
      position.lerp(nextPosition, alpha),
      rotation.slerp(nextRotation, alpha),
      scale.lerp(nextScale, alpha)
    );
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.sampler.dispose();
    this.cache = new WeakMap();
  }
}
