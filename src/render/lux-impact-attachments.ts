import * as THREE from 'three';
import type { LuxImpactFrame, LuxImpactVisual } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import type { TargetPoseSampler } from './target-pose-sampler';

const up = new THREE.Vector3(0, 1, 0);
/** Fixed-tick attachment path in render-world units. Each endpoint samples an
 * independent historical skeleton; interpolation follows the particle step.
 * Unsupported rig poses retain the explicit target-centre +0.9 fallback.
 */
export class LuxImpactAttachments {
  private cache = new WeakMap<LuxImpactFrame, (THREE.Vector3 | undefined)[]>();
  constructor(
    private sampler: TargetPoseSampler | null,
    private ground: (p: Vec2) => number
  ) {}
  private endpoint(effect: LuxImpactVisual, frame: LuxImpactFrame): THREE.Vector3 {
    let pair = this.cache.get(frame);
    if (!pair) this.cache.set(frame, (pair = []));
    const index = effect.critical ? 1 : 0;
    if (pair[index]) return pair[index]!;
    const position = new THREE.Vector3();
    if (this.sampler && effect.targetRig && frame.animationTimeline) {
      const timeline = frame.animationTimeline;
      this.sampler.sample(
        animationLayers(timeline, timeline.tick, MOBILE_CLIP_DURATIONS[effect.targetRig])
      );
      if (!this.sampler.hitPosition(effect.critical, position))
        throw new Error('Source mobile rig lacks its Lux hit attachment');
      position.applyAxisAngle(up, frame.facing);
    } else position.y = 0.9;
    position.add(new THREE.Vector3(frame.x * 0.01, this.ground(frame), frame.y * 0.01));
    pair[index] = position;
    return position;
  }
  point(effect: LuxImpactVisual, tick: number): THREE.Vector3 {
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
