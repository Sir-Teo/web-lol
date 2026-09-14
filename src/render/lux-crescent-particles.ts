import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';
import { luxBasicParticleLife } from '../content/lux-basic-linger';
import { LUX_BASIC_CRESCENT as crescent } from '../content/lux-basic-crescent';
import type { LuxAttackVisual } from '../simulation/types';
import { luxAttackFrame } from './lux-attack-frame';

function curve(times: readonly number[], values: readonly number[], phase: number) {
  if (phase <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) {
    if (phase > times[i]) continue;
    return (
      values[i - 1] +
      ((values[i] - values[i - 1]) * (phase - times[i - 1])) / (times[i] - times[i - 1])
    );
  }
  return values.at(-1)!;
}
export interface LuxCrescentParticle {
  ordinal: number;
  birthTick: number;
  age: number;
  position: readonly [number, number, number];
  facing: number;
  scale: readonly [number, number, number];
  lookup: readonly [number, number];
}
/** Independent reconstruction: emitter-phase binding contributes each parent's
 * step displacement after birth. Natural lifetime, not native linger modes.
 */
export function luxCrescentParticles(effect: LuxAttackVisual, tick: number): LuxCrescentParticle[] {
  if (!Number.isFinite(tick) || tick < effect.launchTick) return [];
  const life = luxBasicParticleLife(
    'crescent',
    crescent.particleLife,
    effect.stopTick !== null && tick >= effect.stopTick
  );
  const now = tick - effect.launchTick;
  const stop = effect.stopTick === null ? Infinity : effect.stopTick - effect.launchTick;
  const last = luxEmissionCount(crescent.rate, now, crescent.emitterLife, stop);
  const particles: LuxCrescentParticle[] = [];
  for (let ordinal = 1; ordinal <= last; ordinal++) {
    const birthTick = luxEmissionBirthTick(crescent.rate, ordinal),
      ageTicks = now - birthTick;
    if (ageTicks < 0 || ageTicks >= life * 60) continue;
    const birth = luxAttackFrame(effect, effect.launchTick + birthTick);
    if (!birth) continue;
    let x = birth.x,
      z = birth.y;
    // Integrate only retained post-birth motion; the 40-frame history covers all
    // naturally live crescents. Interpolate the last complete fixed-step result.
    for (let step = birthTick + 1; step <= Math.ceil(now); step++) {
      const a = luxAttackFrame(effect, effect.launchTick + step - 1);
      const b = luxAttackFrame(effect, effect.launchTick + step);
      if (!a || !b) continue;
      const weight = curve(
        crescent.bind.times,
        crescent.bind.values,
        step / 60 / crescent.emitterLife
      );
      const fraction = Math.min(1, now - step + 1);
      x += (b.x - a.x) * weight * fraction;
      z += (b.y - a.y) * weight * fraction;
    }
    const velocityY = curve(
      crescent.velocity.times,
      crescent.velocity.values.map((v) => v[1]),
      birthTick / 60 / crescent.emitterLife
    );
    const whole = Math.floor(ageTicks),
      fraction = ageTicks - whole,
      decay = 1 - crescent.drag[1] / 60;
    const power = decay ** whole;
    const height =
      (velocityY / 60) * ((decay * (1 - power)) / (1 - decay) + fraction * power * decay);
    const age = ageTicks / 60,
      phase = age / life;
    particles.push({
      ordinal,
      birthTick,
      age,
      position: [x, crescent.offset[1] + height, z],
      facing: birth.facing,
      scale: [0, 1, 2].map(
        (axis) =>
          crescent.birthScale[axis] *
          curve(
            crescent.scale.times,
            crescent.scale.values.map((v) => v[axis]),
            phase
          )
      ) as [number, number, number],
      // Default X=LIFETIME; default Y=CONSTANT ignores its offset.
      lookup: [
        crescent.lookupScales[0] * phase + crescent.lookupOffsets[0],
        crescent.lookupScales[1],
      ],
    });
  }
  return particles;
}
