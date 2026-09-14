import { recallAnimationPose } from './recall-animation';
import type { ChampionState, Unit } from '../simulation/types';
import { castAnimationName } from '../content/cast-animation';
import { RECALL_DURATION_TICKS, TICK_RATE } from '../content/rules';
import { luxAttackAnimation } from '../content/lux-attack-animation';
import { ASHE_Q } from '../content/ashe-q';

export interface MobilePose {
  kind: 'cast' | 'recall' | 'attack' | 'run' | 'idle' | 'death';
  clip: string;
  time: number;
  rate: number;
  loop: boolean;
  /** Elapsed clip-local seconds before looping or endpoint clamping. */
  unclampedTime: number;
  /** Cast/recall enter directly; other modes retain the current 80 ms fade. */
  cut: boolean;
  settled: boolean;
}
/** Pure selection of the current adapter's primary mobile-unit pose. Explicit
 * clip durations come from the loaded reference model. Transition mixtures are
 * separate: this describes the primary action, not the whole blended skeleton.
 */
export function mobilePose(
  unit: Unit,
  state: ChampionState | undefined,
  tick: number,
  alpha: number,
  durations: Readonly<Record<string, number>>,
  terminalAge = 0
): MobilePose {
  const at = tick - 1 + alpha;
  const duration = (name: string) => {
    const value = durations[name];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Missing mobile pose clip: ${name}`);
    return value;
  };
  const fixed = (
    kind: MobilePose['kind'],
    clip: string,
    time: number,
    cut = false,
    rate = 1
  ): MobilePose => ({
    kind,
    clip,
    time: Math.min(Math.max(0, time), duration(clip)),
    rate,
    loop: false,
    unclampedTime: Math.max(0, time),
    cut,
    settled: cut || time >= 0.08,
  });
  if (unit.deadAt !== null)
    return fixed('death', 'death', Math.max(0, (at - unit.deadAt) / TICK_RATE) + terminalAge);
  const cast = state?.castAnimation;
  if (cast) {
    const clip = castAnimationName(unit.champion, cast.ability),
      age = Math.max(0, (at - cast.startTick) / TICK_RATE);
    if (age < duration(clip)) return fixed('cast', clip, age, true);
  }
  if (state?.recallEnd != null) {
    const age = Math.max(0, (at - (state.recallEnd - RECALL_DURATION_TICKS)) / TICK_RATE);
    const pose = recallAnimationPose(unit.champion, age, durations);
    return fixed('recall', pose.clip, pose.unclampedTime, true);
  }

  const moving = Math.hypot(unit.x - unit.previous.x, unit.y - unit.previous.y) > 0.01,
    cycle = unit.attackCycle;
  if (!moving && cycle && tick < cycle.endTick) {
    const clip =
      unit.champion === 'lux'
        ? cycle.critical
          ? 'crit'
          : luxAttackAnimation(unit.id, cycle.startTick)
        : cycle.empowered
          ? ASHE_Q.empoweredAttackAnimation
          : cycle.critical
            ? 'crit'
            : 'attack1';
    const rate = duration(clip) / ((cycle.endTick - cycle.startTick) / TICK_RATE),
      age = Math.max(0, (at - cycle.startTick) / TICK_RATE);
    return { ...fixed('attack', clip, age * rate, false, rate), settled: age >= 0.08 };
  }
  const clip =
      unit.champion === 'garen' ? (moving ? 'run_base' : 'idle1_base') : moving ? 'run' : 'idle1',
    clock = moving ? unit.runClock : unit.idleClock;
  const seconds = clock ? clock.previous + (clock.current - clock.previous) * alpha : 0,
    length = duration(clip);
  return {
    kind: moving ? 'run' : 'idle',
    clip,
    time: length > 0 ? seconds % length : 0,
    rate: moving && clock ? (clock.current - clock.previous) * TICK_RATE : 1,
    loop: true,
    unclampedTime: seconds,
    cut: false,
    settled: !!clock && (tick - clock.startTick + alpha) / TICK_RATE >= 0.08,
  };
}
