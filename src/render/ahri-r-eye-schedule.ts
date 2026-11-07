import data from '../content/ahri-r-particles.json';
import {
  SourceEmitterSchedule,
  type SourceEmitterScheduleDefinition,
} from './source-emitter-schedule';

export const AHRI_R_EYE_PERIOD_POLICY = {
  hz: 60,
  firstUpdateTick: 1,
  omittedLifetime: 'cessation belongs to the observed buff producer; no fixed lifetime fallback',
  cosmeticOrdinal: 'local update tick and in-step slot; not a native pool/RNG identity',
  nativeConstructorVerified: false,
} as const;
export interface REyeBirthEvent {
  ordinal: number;
  time: number;
  share: number;
  phase: number;
  updateTick: number;
}
const profiles = new Map<
  number,
  { definition: SourceEmitterScheduleDefinition; periodTicks: number; retainedTicks: number }
>();
for (const [offset, index] of [47, 48].entries()) {
  const p = data.profiles[index],
    period = [3, 2.5][offset],
    active = [3, Math.fround(0.6)][offset],
    rate = [50, 100][offset],
    life = [Math.fround(0.2), Math.fround(0.15)][offset];
  if (
    p.system !== 'Ahri_R_Eyes' ||
    p.name !== ['trail', 'trail1'][offset] ||
    p.emitterLife !== null ||
    p.single ||
    p.delay !== 0 ||
    p.period !== period ||
    p.timeActiveDuringPeriod !== active ||
    p.rate.authoredKeyCount !== 0 ||
    p.rate.constant.length !== 1 ||
    p.rate.constant[0] !== rate ||
    p.rate.probabilities.length !== 0 ||
    p.life.authoredKeyCount !== 0 ||
    p.life.constant.length !== 1 ||
    p.life.constant[0] !== life ||
    p.life.probabilities.length !== 0 ||
    [...p.bindingRequirements].sort().join(',') !== 'emitter-lifetime,emitter-period-policy'
  )
    throw Error('R periodic eye-trail source closure differs');
  profiles.set(index, {
    definition: {
      rate: p.rate,
      window: {
        lifetime: null,
        particleLifetimeMaximum: life,
        simple: false,
        singleParticle: false,
        overridesMaterials: false,
        delay: 0,
        emitterLinger: p.emitterLinger ?? 0,
        period: { length: period, active },
      },
      variableStart: false,
      maxPerFrame: 0,
      segmentLimit: null,
      rateScale: 1,
    },
    periodTicks: period * 60,
    retainedTicks: Math.ceil(life * 60) + 1,
  });
}
/** Constant positive rates and an integral period make the boundary a complete
 * count-history barrier: max(cycleStart,lastSpawn) is cycleStart at its first
 * update. The pool counter is irrelevant without a segment limit. Replaying
 * only the recent cycles therefore preserves full-kernel timing/phase exactly.
 * The owning buff renderer must separately suppress births at its observed end. */
export function rEyeBirthEvents(profileIndex: number, time: number): REyeBirthEvent[] {
  const p = profiles.get(profileIndex);
  if (
    !p ||
    !Number.isFinite(time) ||
    time < 0 ||
    !Number.isSafeInteger(Math.floor(time * 60 + 1e-8)) ||
    time * 60 > Number.MAX_SAFE_INTEGER / 2
  )
    throw RangeError('Invalid periodic eye emission seek');
  const whole = Math.floor(time * 60 + 1e-8),
    earliest = Math.max(1, whole - p.retainedTicks),
    begin = Math.floor(Math.max(0, earliest - 1) / p.periodTicks) * p.periodTicks;
  const schedule = new SourceEmitterSchedule(
    p.definition,
    begin === 0 ? undefined : { now: begin / 60, lastSpawn: begin / 60, emitted: true, spawned: 0 }
  );
  const events: REyeBirthEvent[] = [];
  for (let tick = begin + 1; tick <= whole; tick++) {
    const births = schedule.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0);
    if (births.length > 2) throw Error('R eye-trail per-step birth bound differs');
    if (tick < earliest) continue;
    births.forEach((birth, slot) =>
      events.push({ ...birth, ordinal: tick * 2 + slot, updateTick: tick })
    );
  }
  return events;
}
