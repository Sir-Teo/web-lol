import type { StructureAnimationProfile } from '../content/structure-animation';
export interface StructurePoseState {
  destroyed: boolean;
  idleStartTick: number;
  deathTick: number | null;
}
/** Pure selection for the current structure adapter. Input timestamps may be
 * actual or observer-known; this function neither queries nor grants visibility.
 * Static rubble stays at clip start. Full native event sequencing is separate.
 */
export function structurePose(
  state: StructurePoseState,
  profile: StructureAnimationProfile,
  tick: number,
  alpha: number,
  terminalAge = 0
) {
  const duration = (clip: string) => {
    const time = profile.durations[clip];
    if (!Object.hasOwn(profile.durations, clip) || !Number.isFinite(time) || time < 0)
      throw new Error(`Missing structure pose clip: ${clip}`);
    return time;
  };
  const pose = (
    kind: 'idle' | 'destroyed' | 'dead-idle',
    clip: string,
    seconds: number,
    loop: boolean
  ) => {
    const length = duration(clip);
    return {
      kind,
      clip,
      time: loop && length > 0 ? seconds % length : Math.min(seconds, length),
      loop,
    };
  };
  if (!state.destroyed) {
    const age = Math.max(0, (tick - 1 + alpha - state.idleStartTick) / 60) + terminalAge;
    return pose('idle', 'idle1', age, true);
  }
  if (state.deathTick === null) throw new Error('Destroyed structure lacks a known death tick');
  if (!profile.animateDestruction) return pose('destroyed', profile.destroyedClip, 0, false);
  const age = Math.max(0, (tick - 1 + alpha - state.deathTick) / 60) + terminalAge;
  const deathDuration = duration(profile.destroyedClip);
  if (profile.deadIdleClip && age >= deathDuration)
    return pose('dead-idle', profile.deadIdleClip, age - deathDuration, true);
  return pose('destroyed', profile.destroyedClip, age, false);
}
