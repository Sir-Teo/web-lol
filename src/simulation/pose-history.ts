import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../content/mobile-clip-durations';
import {
  STRUCTURE_ANIMATION_PROFILES,
  structureAnimationProfile,
  type StructureRig,
} from '../content/structure-animation';
import { structurePose } from '../render/structure-pose';
import { cloneAnimationTimeline, validAnimationTimeline } from './animation-timeline';
import { isStructureKind, type LuxImpactFrame, type Unit } from './types';

/** Called again after animation/recall placement to finalize a contact tick. */
export function capturePoseFrame(target: Unit, tick: number): LuxImpactFrame {
  return {
    tick,
    x: target.x,
    y: target.y,
    facing: target.facing,
    animationTimeline: cloneAnimationTimeline(target.animationTimeline),
    structurePose: isStructureKind(target.kind)
      ? structurePose(
          {
            destroyed: target.hp <= 0,
            deathTick: target.deadAt,
            idleStartTick: target.structureIdle!.startTick,
          },
          structureAnimationProfile(target),
          tick,
          1
        )
      : null,
  };
}

/** Historical poses use their own rig/clock, never the live target's later pose. */
export function validPoseFrame(
  frame: LuxImpactFrame,
  rig: string | null,
  attached: boolean
): boolean {
  const durations =
    rig && Object.hasOwn(MOBILE_CLIP_DURATIONS, rig)
      ? MOBILE_CLIP_DURATIONS[rig as MobileRig]
      : undefined;
  const profile =
    rig && Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, rig)
      ? STRUCTURE_ANIMATION_PROFILES[rig as StructureRig]
      : undefined;
  if (
    !validAnimationTimeline(frame.animationTimeline, durations, frame.tick) ||
    (attached && frame.animationTimeline !== null && frame.animationTimeline.tick !== frame.tick) ||
    !!frame.structurePose !== !!profile
  )
    return false;
  if (!profile || !frame.structurePose) return true;
  const p = frame.structurePose;
  if (
    !Object.hasOwn(profile.durations, p.clip) ||
    p.time > profile.durations[p.clip as keyof typeof profile.durations]
  )
    return false;
  if (attached && p.kind !== 'idle') return false;
  if (p.kind === 'idle') return p.clip === 'idle1' && p.loop;
  if (p.kind === 'dead-idle')
    return p.clip === profile.deadIdleClip && p.loop && profile.animateDestruction;
  return (
    p.clip === profile.destroyedClip && !p.loop && (profile.animateDestruction || p.time === 0)
  );
}

export function samePose(a: LuxImpactFrame, b: LuxImpactFrame): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.facing === b.facing &&
    JSON.stringify(a.animationTimeline) === JSON.stringify(b.animationTimeline) &&
    JSON.stringify(a.structurePose) === JSON.stringify(b.structurePose)
  );
}
