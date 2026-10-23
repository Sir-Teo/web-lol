import { Euler, Vector3 } from 'three';
import profiles from '../content/lux-e-field.json';
import { emitterBirthTicks, sampleEmitterValue } from './particle-emitter-value';
import { luxHoopChance } from './lux-hoop-particles';
import { luxEBurstTravel } from './lux-e-burst-particles';
import { particleColorLookup } from './particle-color-lookup';
import { accumulateParticleCurve, type ParticleCurve } from './particle-curves';

/** Schedules are immutable and shared across casts. Per-birth emitter properties
 * are captured at normalized emitter age, then independently aged/searched. */
export const LUX_E_FIELD_BIRTHS = profiles.map((p) =>
  p.single
    ? Array.from({ length: Math.max(1, Math.trunc(p.rate.values[0][0])) }, () => 0)
    : emitterBirthTicks(p.rate, p.emitterLife)
);
export function luxEFieldParticles(role: 'ally' | 'enemy', seed: number, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (p.role !== role) return [];
    const result = [];
    const integrated = new Map<string, number[]>();
    const sum = (name: string, curve: ParticleCurve, age: number, life: number) => {
      const key = `${name}:${age}:${life}`;
      let value = integrated.get(key);
      if (!value) {
        value = curve.values[0].map((_, axis) =>
          curve.values.every((v) => v[axis] === 0)
            ? 0
            : accumulateParticleCurve(curve, age, life, axis)
        );
        integrated.set(key, value);
      }
      return value;
    };
    for (const [slot, tick] of LUX_E_FIELD_BIRTHS[profileIndex].entries()) {
      const birthSeconds = tick / 60;
      if (birthSeconds > seconds) break;
      const ordinal = slot + 1,
        emitterPhase = birthSeconds / p.emitterLife,
        emitterSeed = seed ^ Math.imul(p.index + 1, 0x85ebca6b),
        chance = luxHoopChance(emitterSeed, ordinal);
      const sample = (v: Parameters<typeof sampleEmitterValue>[0]) =>
        sampleEmitterValue(v, emitterPhase, chance);
      const age = seconds - birthSeconds,
        life = sample(p.life)[0];
      if (age >= life) continue;
      const phase = age / life,
        velocity = new Vector3(...sample(p.velocity)),
        offset = new Vector3(...sample(p.offset));
      for (let i = 0; i < p.shapeAngles.length; i++) {
        const axis = new Vector3(...p.shapeAxes[i]).normalize(),
          angle = (sample(p.shapeAngles[i])[0] * Math.PI) / 180;
        velocity.applyAxisAngle(axis, angle);
        offset.applyAxisAngle(axis, angle);
      }
      const motion = luxEBurstTravel(velocity.toArray(), [0, 0, 0], sample(p.drag), age);
      const orbit = sample(p.orbit).map((v) => v * age),
        rotation = new Euler(orbit[0], orbit[1], orbit[2], 'YXZ');
      const position = offset
          .add(new Vector3(...sample(p.position)))
          .add(new Vector3(...motion.position))
          .applyEuler(rotation)
          .toArray(),
        travel = new Vector3(...motion.travel).applyEuler(rotation).toArray();
      const lifetime = (v: Parameters<typeof sampleEmitterValue>[0]) =>
        sampleEmitterValue(v, phase, chance);
      const scale = sample(p.size).map((v, axis) => v * lifetime(p.scale)[axis]);
      if (p.uniform) scale.fill(scale[0]);
      const angular = sample(p.angular),
        turn = sum('turn', p.rotationRate, age, life),
        scroll = sum('scroll', p.multScroll, age, life),
        roll = sample(p.rotation).map((v, axis) => v + angular[axis] * age + 60 * turn[axis]);
      result.push({
        profileIndex,
        ordinal,
        birthSeconds,
        emitterPhase,
        age,
        life,
        chance,
        position,
        travel,
        scale,
        rotation: roll,
        multOffset: sample(p.multOffset).map((v, axis) => v + scroll[axis]),
        multScale: lifetime(p.multScale),
        color: sample(p.birthColor).map((v, axis) => v * lifetime(p.color)[axis]),
        frame: p.atlas.random
          ? Math.floor(luxHoopChance(emitterSeed ^ 0x7f4a7c15, ordinal) * p.atlas.frames)
          : 0,
        stretch: p.direction
          ? Math.max(p.directionMin, Math.hypot(...travel) * p.directionScale)
          : 1,
        lookup: particleColorLookup(p, phase, chance, travel),
      });
    }
    return result;
  });
}
