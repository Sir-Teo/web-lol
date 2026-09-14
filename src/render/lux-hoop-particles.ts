import { luxBasicParticleLife } from '../content/lux-basic-linger';
import { LUX_BASIC_HOOP_APPEARANCE as appearance } from '../content/lux-basic-lookups';
import { particleLookupCoordinate } from './particle-lookup';

/** Pinned Lux_Base_BA_mis/hoop values. Source units; local emitter at rest.
 * Our reconstruction uses a 60 Hz emission/integration grid and a stable indexed
 * hash. The native random sequence and update rate are not claimed identical.
 */
export const LUX_HOOP = {
  rate: 200,
  duration: 10,
  dragY: 2,
  upwardVelocity: 200,
  orbitY: 2,
  radius: 10,
  size: 30,
  sizeMin: 0.3499999940395355,
  lifeKnot: 0.8999999761581421,
  lifeFactors: [0.5, 1.5, appearance.maxLifetimeFactor],
} as const;
const HZ = 60;

export function luxHoopChance(seed: number, ordinal: number): number {
  let value = Math.imul(seed ^ Math.imul(ordinal, 0x85ebca6b), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 16), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Explicit chance makes source-distribution boundaries inspectable. */
export function luxHoopBirth(chance: number) {
  const c = Math.max(0, Math.min(1, chance));
  const [low, middle, high] = LUX_HOOP.lifeFactors;
  const factor =
    c < LUX_HOOP.lifeKnot
      ? low + ((middle - low) * c) / LUX_HOOP.lifeKnot
      : middle + ((high - middle) * (c - LUX_HOOP.lifeKnot)) / (1 - LUX_HOOP.lifeKnot);
  return {
    life: appearance.nominalLifetime * factor,
    velocityY: LUX_HOOP.upwardVelocity * (1 + c),
    // The authored empty X/Z probability tables annihilate those channels.
    velocityX: 0,
    velocityZ: 0,
    angle: c * Math.PI * 2,
    size: LUX_HOOP.size * (LUX_HOOP.sizeMin + (1 - LUX_HOOP.sizeMin) * c),
  };
}

/** Sum the fixed-step velocity decay, interpolating only its last display step.
 * This reproduces v *= max(0, 1 - drag * dt); y += v * dt, not exponential drag.
 */
function height(velocity: number, ticks: number): number {
  const whole = Math.floor(ticks),
    fraction = ticks - whole;
  const decay = 1 - LUX_HOOP.dragY / HZ;
  const power = decay ** whole;
  return (velocity / HZ) * ((decay * (1 - power)) / (1 - decay) + fraction * power * decay);
}

export interface LuxHoopParticle {
  ordinal: number;
  birthTick: number;
  age: number;
  life: number;
  position: readonly [number, number, number];
  size: number;
  lookup: readonly [number, number];
  color: typeof appearance.birthColor;
}

/** Reconstruct the live window directly, so display rate and seek order cannot
 * consume random draws or alter the result. stopSeconds stops emission, not aging.
 */
export function luxHoopParticles(
  seed: number,
  seconds: number,
  stopSeconds: number = LUX_HOOP.duration
): LuxHoopParticle[] {
  if (!Number.isFinite(seconds) || !Number.isFinite(stopSeconds) || seconds < 0) return [];
  const nowTick = seconds * HZ;
  const lastTick = Math.floor(Math.min(seconds, Math.max(0, stopSeconds), LUX_HOOP.duration) * HZ);
  const last = Math.floor((lastTick * LUX_HOOP.rate) / HZ);
  const maxLife = appearance.nominalLifetime * LUX_HOOP.lifeFactors[2];
  // One grid step of margin includes every potentially living ordinal.
  const first = Math.max(1, Math.floor((seconds - maxLife - 1 / HZ) * LUX_HOOP.rate));
  const particles: LuxHoopParticle[] = [];
  for (let ordinal = first; ordinal <= last; ordinal++) {
    const birthTick = Math.ceil((ordinal * HZ) / LUX_HOOP.rate);
    const age = (nowTick - birthTick) / HZ;
    const birth = luxHoopBirth(luxHoopChance(seed, ordinal));
    const life = luxBasicParticleLife('hoop', birth.life, seconds >= stopSeconds);
    if (age < 0 || age >= life) continue;
    const phase = age / life;
    const angle = birth.angle + LUX_HOOP.orbitY * age;
    const state = { age01: phase, birthRandom: 0, travelPerSecond: [0, 0, 0] as const };
    particles.push({
      ordinal,
      birthTick,
      age,
      life,
      position: [
        LUX_HOOP.radius * Math.cos(angle),
        height(birth.velocityY, age * HZ),
        -LUX_HOOP.radius * Math.sin(angle),
      ],
      size: birth.size * (1 - 0.5 * phase),
      lookup: [
        particleLookupCoordinate(appearance.lookupX, state),
        particleLookupCoordinate(appearance.lookupY, state),
      ],
      color: appearance.birthColor,
    });
  }
  return particles;
}
