import { structureModelMatrix } from './structure-transform';
import type { MobileRig } from '../content/mobile-clip-durations';
import * as THREE from 'three';
import type { LuxImpactFrame, LuxImpactVisual } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import type { TargetPoseSampler } from './target-pose-sampler';

const up = new THREE.Vector3(0, 1, 0);
export type AttachmentHistory = Pick<LuxImpactVisual, 'frames' | 'targetTransform' | 'critical'> & {
  targetRig: string | null;
};
/** Fixed-tick attachment path in render-world units. Each endpoint samples an
 * independent historical skeleton; interpolation follows the particle step.
 * Missing structure bones and procedural targets retain the explicit centre +0.9 fallback.
 */
export class ImpactAttachments {
  private cache = new WeakMap<LuxImpactFrame, (THREE.Vector3 | undefined)[]>();
  constructor(
    private sampler: TargetPoseSampler | null,
    private ground: (p: Vec2) => number,
    private bone: (critical: boolean) => string
  ) {}
  private endpoint(effect: AttachmentHistory, frame: LuxImpactFrame): THREE.Vector3 {
    let pair = this.cache.get(frame);
    if (!pair) this.cache.set(frame, (pair = []));
    const index = effect.critical ? 1 : 0;
    if (pair[index]) return pair[index]!;
    const position = new THREE.Vector3();
    let attached = false;
    if (this.sampler && effect.targetRig && frame.animationTimeline) {
      const timeline = frame.animationTimeline;
      this.sampler.sample(
        animationLayers(
          timeline,
          timeline.tick,
          MOBILE_CLIP_DURATIONS[effect.targetRig as MobileRig]
        )
      );
      if (!this.sampler.bonePosition(this.bone(effect.critical), position))
        throw new Error('Source mobile rig lacks its authored hit attachment');
      attached = true;
    } else if (this.sampler && frame.structurePose) {
      this.sampler.sample([{ ...frame.structurePose, weight: 1 }]);
      attached = this.sampler.bonePosition(this.bone(effect.critical), position);
      if (!attached && effect.targetRig?.endsWith('-turret'))
        throw new Error('Source turret rig lacks its authored hit attachment');
    } else if (this.sampler && effect.targetRig === 'sightward-base') {
      this.sampler.sample([]);
      attached = this.sampler.bonePosition(this.bone(effect.critical), position);
    }
    if (attached && frame.structurePose && effect.targetTransform) {
      position.applyMatrix4(structureModelMatrix(effect.targetTransform));
    } else {
      if (attached && frame.structurePose) position.z *= -1;
      else if (attached) position.applyAxisAngle(up, frame.facing);
      else position.set(0, 0.9, 0);
      position.add(new THREE.Vector3(frame.x * 0.01, this.ground(frame), frame.y * 0.01));
    }
    pair[index] = position;
    return position;
  }
  point(effect: AttachmentHistory, tick: number): THREE.Vector3 {
    const frames = effect.frames,
      first = frames[0],
      last = frames.at(-1)!;
    if (tick <= first.tick) return this.endpoint(effect, first).clone();
    if (tick >= last.tick) return this.endpoint(effect, last).clone();
    const i = Math.floor(tick) - first.tick;
    return this.endpoint(effect, frames[i])
      .clone()
      .lerp(this.endpoint(effect, frames[i + 1]), tick - frames[i].tick);
  }
  dispose() {
    this.sampler?.dispose();
    this.cache = new WeakMap();
  }
}
