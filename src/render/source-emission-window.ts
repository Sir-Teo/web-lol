export interface SourceEmissionWindow {
  lifetime: number | null;
  particleLifetimeMaximum: number;
  simple: boolean;
  singleParticle: boolean;
  overridesMaterials: boolean;
  delay: number;
  emitterLinger: number;
  period: { length: number | null; active: number | null } | null;
}
/** The selected external clock policy, after resolving the lifetime maximum.
 * Phase is neither clamped nor restarted at period boundaries. Stop wait uses
 * absolute system age, not elapsed time since the stop command. */
export function sourceEmissionWindow(profile: SourceEmissionWindow, age: number) {
  const {
    lifetime,
    particleLifetimeMaximum,
    simple,
    singleParticle,
    overridesMaterials,
    delay,
    emitterLinger,
    period,
  } = profile;
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    ![particleLifetimeMaximum, delay, emitterLinger].every(Number.isFinite) ||
    (lifetime !== null && !Number.isFinite(lifetime)) ||
    ![simple, singleParticle, overridesMaterials].every((v) => typeof v === 'boolean') ||
    (period !== null &&
      ![period.length, period.active].every((v) => v === null || Number.isFinite(v)))
  )
    throw RangeError('Invalid resolved source emission window');
  let end = lifetime;
  if (
    !simple &&
    singleParticle &&
    !overridesMaterials &&
    particleLifetimeMaximum !== -1 &&
    (end === null || end > particleLifetimeMaximum + 10)
  )
    end = particleLifetimeMaximum;
  const span = Math.min(end ?? Infinity, period?.active ?? Infinity, period?.length ?? Infinity);
  const into = period?.length == null ? age : age % period.length;
  return {
    end,
    phase: span === Infinity || Math.abs(span) <= 1e-6 ? 0 : (age - delay) / span,
    waiting: age < delay,
    ended: end !== null && age >= end,
    active: period === null || period.active === null || period.active > into,
    stopWait: Math.min((simple ? 0 : (end ?? Infinity)) + 10, Math.max(emitterLinger, 0)),
  };
}
