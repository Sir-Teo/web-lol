import { mobileClipDurations } from '../content/mobile-clip-durations';
import { mobilePose } from '../render/mobile-pose';
import { advanceAnimationTimeline } from './animation-timeline';
import { capturePoseFrame } from './pose-history';
import type { LuxImpactFrame, Unit } from './types';

/** Preview the stationary body's release-tick pose before later damage can
 * replace it with a death pose. Uses the local animation adapter, not a native
 * animation-graph certificate. No unit, timeline or random state is mutated. */
export function captureBaronReleasePose(source: Unit, tick: number): LuxImpactFrame {
  if (
    source.monster?.species !== 'baron' ||
    source.deadAt !== null ||
    !Number.isSafeInteger(tick) ||
    tick < 0 ||
    source.releaseTick !== tick
  )
    throw Error('Baron release pose requires its living release tick');
  const durations = mobileClipDurations(source);
  if (!durations) throw Error('Baron release pose lacks clip durations');
  const frame = capturePoseFrame(source, tick);
  frame.animationTimeline = advanceAnimationTimeline(
    frame.animationTimeline,
    mobilePose(source, undefined, tick, 1, durations, 0, false),
    tick,
    durations
  );
  return frame;
}
