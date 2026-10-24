import { leonaAttackAnimation } from '../content/leona-presentation';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';
import { garenAttackAnimation } from '../content/garen-attack-animation';
import { recallAnimationPose } from './recall-animation';
import { SCUTTLER_POLICY } from '../content/scuttler-policy';
import { MONSTERS } from '../content/monsters';
import type { ChampionState, Unit } from '../simulation/types';
import { castAnimationName } from '../content/cast-animation';
import { RECALL_DURATION_TICKS, TICK_RATE } from '../content/rules';
import { luxAttackAnimation } from '../content/lux-attack-animation';
import { ASHE_Q } from '../content/ashe-q';
import { GAREN_Q } from '../content/garen-q';
import { GAREN_E } from '../content/garen-e';
import { GAREN_R_ANIMATION_CONTACT, GAREN_R_WINDUP_TICKS } from '../content/garen-r-policy';

export interface MobilePose {
  kind: 'spawn' | 'cast' | 'recall' | 'attack' | 'run' | 'idle' | 'death';
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
    cut: cut || (unit.kind === 'monster' && unit.animationTimeline?.primary.kind === 'spawn'),
    settled: cut || time >= 0.08,
  });
  const scuttler = unit.kind === 'monster' && unit.monster.species === 'scuttler';
  if (scuttler && unit.deadAt !== null) return fixed('death', 'hide', 0, true);
  if (scuttler && unit.monster!.spawn) {
    const age = at - unit.monster!.spawn.startTick;
    return age < SCUTTLER_POLICY.hiddenTicks
      ? fixed('spawn', 'hide', 0, true)
      : fixed('spawn', 'spawn', (age - SCUTTLER_POLICY.hiddenTicks) / TICK_RATE, true);
  }
  if (unit.deadAt !== null)
    return fixed('death', 'death', Math.max(0, (at - unit.deadAt) / TICK_RATE) + terminalAge);
  if (unit.kind === 'monster' && unit.monster.spawn)
    return fixed(
      'spawn',
      unit.monster.spawn.clip,
      (at - unit.monster.spawn.startTick) / TICK_RATE,
      true
    );
  const leonaCycle = unit.champion === 'leona' ? unit.attackCycle : null;
  const leonaMoving = Math.hypot(unit.x - unit.previous.x, unit.y - unit.previous.y) > 0.01;
  if (
    leonaCycle?.leonaQReleaseTick !== undefined &&
    tick < leonaCycle.endTick &&
    (!leonaMoving || unit.releaseTick !== null)
  ) {
    const clip = 'spell1',
      contact = LEONA_COMBAT_POLICY.daybreakWindupTicks / TICK_RATE;
    const windup = (leonaCycle.leonaQReleaseTick - leonaCycle.startTick) / TICK_RATE;
    const recovery = (leonaCycle.endTick - leonaCycle.leonaQReleaseTick) / TICK_RATE;
    const age = Math.max(0, (at - leonaCycle.startTick) / TICK_RATE);
    const rate = age < windup ? contact / windup : (duration(clip) - contact) / recovery;
    return fixed(
      'attack',
      clip,
      age < windup ? age * rate : contact + (age - windup) * rate,
      false,
      rate
    );
  }
  if (state?.garenE) {
    const spin = state.garenE,
      clip = GAREN_E.animationClip;
    const rate = ((duration(clip) / GAREN_E.durationSeconds) * spin.strikes) / GAREN_E.baseStrikes;
    const time = Math.max(0, (at - spin.startTick) / TICK_RATE) * rate;
    return { ...fixed('cast', clip, time, true, rate), time: time % duration(clip), loop: true };
  }
  const cast = state?.castAnimation;
  if (cast) {
    const clip = castAnimationName(unit.champion, cast.ability),
      age = Math.max(0, (at - cast.startTick) / TICK_RATE);
    if (unit.champion === 'garen' && cast.ability === 'r') {
      const windup = GAREN_R_WINDUP_TICKS / TICK_RATE;
      const rate = age < windup ? GAREN_R_ANIMATION_CONTACT / windup : 1;
      const time = age < windup ? age * rate : GAREN_R_ANIMATION_CONTACT + age - windup;
      if (time < duration(clip)) return fixed('cast', clip, time, true, rate);
    } else if (age < duration(clip)) return fixed('cast', clip, age, true);
  }
  if (unit.champion === 'leona' && state?.leonaDash)
    return fixed('cast', 'spell3', (at - state.leonaDash.castTick) / TICK_RATE, true);
  if (state?.recallEnd != null) {
    const age = Math.max(0, (at - (state.recallEnd - RECALL_DURATION_TICKS)) / TICK_RATE);
    const pose = recallAnimationPose(unit.champion, age, durations);
    return fixed('recall', pose.clip, pose.unclampedTime, true);
  }

  const moving = Math.hypot(unit.x - unit.previous.x, unit.y - unit.previous.y) > 0.01,
    cycle = unit.attackCycle;
  if (!moving && cycle && tick < cycle.endTick) {
    if (unit.kind === 'monster') {
      if (unit.monster.species === 'scuttler')
        throw new Error('Peaceful Scuttler cannot have an attack cycle');
      const age = Math.max(0, (at - cycle.startTick) / TICK_RATE);
      const windup = unit.windupTicks / TICK_RATE;
      const contact = MONSTERS[unit.monster.species].castFrame / 30;
      const recovery = (cycle.endTick - cycle.startTick) / TICK_RATE - windup;
      const rate = age < windup ? contact / windup : (duration('attack1') - contact) / recovery;
      const time = age < windup ? age * rate : contact + (age - windup) * rate;
      return { ...fixed('attack', 'attack1', time, false, rate), settled: age >= 0.08 };
    }
    if (cycle.garenQReleaseTick !== undefined) {
      const clip = 'spell1';
      const contact = GAREN_Q.attackTiming.animationCastFrame / GAREN_Q.attackTiming.animationFps;
      const windup = (cycle.garenQReleaseTick - cycle.startTick) / TICK_RATE;
      const recovery = (cycle.endTick - cycle.garenQReleaseTick) / TICK_RATE;
      const age = Math.max(0, (at - cycle.startTick) / TICK_RATE);
      const rate = age < windup ? contact / windup : (duration(clip) - contact) / recovery;
      const time = age < windup ? age * rate : contact + (age - windup) * rate;
      return { ...fixed('attack', clip, time, false, rate), settled: age >= 0.08 };
    }
    const clip =
      cycle.garenQRank !== undefined
        ? 'spell1'
        : unit.champion === 'leona'
          ? leonaAttackAnimation(unit.id, cycle.startTick, cycle.critical, cycle.leonaEclipse)
          : unit.champion === 'garen'
            ? garenAttackAnimation(unit.id, cycle.startTick, cycle.critical)
            : unit.champion === 'lux'
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
      unit.champion === 'leona' && state?.leonaW
        ? moving
          ? 'spell2_run'
          : 'spell2_idle'
        : unit.champion === 'garen'
          ? moving
            ? 'run_base'
            : 'idle1_base'
          : scuttler && unit.stunUntil > tick
            ? 'stun'
            : moving
              ? scuttler && unit.monster!.phase === 'engaged'
                ? 'flee'
                : 'run'
              : 'idle1',
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
    cut: unit.kind === 'monster' && unit.animationTimeline?.primary.kind === 'spawn',
    settled: !!clock && (tick - clock.startTick + alpha) / TICK_RATE >= 0.08,
  };
}
