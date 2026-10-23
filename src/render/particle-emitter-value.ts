import { sampleParticleCurve, type ParticleCurve } from './particle-curves';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';

export interface EmitterValue extends ParticleCurve {
  probabilities:
    readonly { times: readonly number[]; values: readonly number[]; single?: number }[] | null;
}
/** Source birth curves use emitter age; lifetime curves are evaluated separately
 * with particle age. Multiplier tables retain one stable indexed birth chance. */
export function sampleEmitterValue(value: EmitterValue, phase: number, chance: number) {
  return luxBeamBirthOffset(
    {
      value: value.values[0].map((_, axis) => sampleParticleCurve(value, phase, axis)),
      probabilities: value.probabilities,
    },
    chance
  );
}
/** Local right-endpoint 60 Hz rate budget. The forced first birth is charged to
 * the budget, matching the existing constant-rate Lux adapter. Kahan summation
 * avoids losing exact integer crossings to repeated floating point addition.
 * Native initialization, normalized rate time and PRNG remain unverified. */
export function emitterBirthTicks(rate: EmitterValue, life: number) {
  if (!Number.isFinite(life) || life <= 0 || rate.probabilities !== null)
    throw new RangeError('Expected a finite emitter lifetime and deterministic rate curve');
  const births: number[] = [];
  let budget = 0,
    correction = 0;
  for (let tick = 1; tick <= Math.floor(life * 60); tick++) {
    const amount = Math.max(0, sampleEmitterValue(rate, tick / 60 / life, 0.5)[0]) / 60;
    const adjusted = amount - correction,
      next = budget + adjusted;
    correction = next - budget - adjusted;
    budget = next;
    const count = amount > 0 ? Math.max(1, Math.floor(budget + 1e-9)) : Math.floor(budget + 1e-9);
    while (births.length < count) births.push(tick);
  }
  return births;
}
