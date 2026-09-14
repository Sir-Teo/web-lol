import profile from '../content/lux-charge-rays.json';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';

type Curve = { times: readonly number[]; values: readonly (readonly number[])[] };
function sample(curve: Curve, time: number, axis: number) {
  if (time <= curve.times[0]) return curve.values[0][axis];
  for (let i = 1; i < curve.times.length; i++)
    if (time <= curve.times[i])
      return (
        curve.values[i - 1][axis] +
        ((curve.values[i][axis] - curve.values[i - 1][axis]) * (time - curve.times[i - 1])) /
          (curve.times[i] - curve.times[i - 1])
      );
  return curve.values.at(-1)![axis];
}

/** Integrate right-endpoint source rates on the same 60 Hz reconstruction grid
 * used by particle motion, interpolating the next step at fractional ages. */
function accumulated(curve: Curve, age: number, axis: number) {
  const ticks = age * 60,
    whole = Math.floor(ticks);
  let value = 0;
  for (let tick = 1; tick <= whole; tick++)
    value += sample(curve, tick / 60 / profile.life, axis) / 60;
  return value + ((ticks - whole) * sample(curve, (whole + 1) / 60 / profile.life, axis)) / 60;
}

export function luxChargeRayBirth(chance: number) {
  return {
    rotation: luxBeamBirthOffset(profile.birthRotation, chance)[0],
    halfSize: luxBeamBirthOffset(profile.birthSize, chance),
    multOffset: luxBeamBirthOffset(profile.multBirth, chance),
  };
}

/** Ten camera quads born together. Source units/degrees; the view adapter owns
 * camera-facing geometry. Indexed randomness and the 60 Hz grid are reconstruction
 * policies, not a claim of native PRNG or frame-rate parity. */
export function luxChargeRayParticles(seed: number, age: number) {
  if (!Number.isFinite(age) || age < 0 || age >= profile.life) return [];
  const phase = age / profile.life;
  const turn =
    profile.birthAngularVelocity[0] * age + 60 * accumulated(profile.rotationRate, age, 0);
  const scroll = [0, 1].map((axis) => accumulated(profile.multScrollRate, age, axis));
  return Array.from({ length: profile.count }, (_, index) => {
    const chance = luxHoopChance(seed, index + 1),
      birth = luxChargeRayBirth(chance);
    return {
      ordinal: index + 1,
      rotation: birth.rotation + turn,
      halfSize: birth.halfSize.map((size, axis) => size * sample(profile.scale, phase, axis)),
      color: profile.birthColor.map((color, axis) => color * sample(profile.color, phase, axis)),
      multOffset: birth.multOffset.map((offset, axis) => offset + scroll[axis]),
    };
  });
}
