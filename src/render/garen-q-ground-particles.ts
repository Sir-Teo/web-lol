import { Quaternion, Vector3 } from 'three';
import profiles from '../content/garen-q-ground-particles.json';
import type { ChampionState } from '../simulation/types';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Closed-form sum of source-style stepped drag, interpolating the next segment.
 * Draw-time worldAcceleration adds a * age * lifetime independently of travel.
 * Source units are retained; the scene adapter owns the ground/heading transform. */
export function garenQGroundMotion(
  velocity: number[],
  drag: number[],
  acceleration: number[],
  life: number,
  age: number
) {
  const whole = Math.floor(age * 60),
    fraction = age * 60 - whole;
  const travel: number[] = [];
  const offset = velocity.map((v, axis) => {
    const decay = Math.max(0, 1 - drag[axis] / 60),
      power = decay ** whole;
    travel.push(v * power * decay);
    return (
      (decay === 1
        ? v * age
        : (v / 60) * ((decay * (1 - power)) / (1 - decay) + fraction * power * decay)) +
      acceleration[axis] * age * life
    );
  });
  return { offset, travel };
}

/** Jump's absent authored frame uses local commitment dispatch. Landing requires
 * the saved frame-9 event anchor, not the planned release or current caster root.
 * Local policy lets accepted one-shots finish naturally after pose stops; the
 * source's create/kill-event flag alone does not prove parent-stop semantics. */
export function garenQGroundParticles(
  id: number,
  records: ChampionState['garenQVisuals'],
  tick: number
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    record.attacks.flatMap((attack) =>
      profiles.flatMap((p, profileIndex) => {
        const event =
          p.role === 'jump'
            ? { tick: attack.startTick, point: attack.origin, facing: attack.facing }
            : attack.landing;
        if (!event) return [];
        // First eligible update after dispatch; positive delays are tested against
        // absolute system age rather than adding an extra empty update afterward.
        const born = Math.max(1, Math.ceil(p.delay * 60 - 1e-5)),
          age = (tick - event.tick - born) / 60;
        if (age < 0) return [];
        const seed =
          id ^ Math.imul(attack.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 61, 0x85ebca6b);
        const particles = [];
        for (let ordinal = 1; ordinal <= p.count; ordinal++) {
          const chance = luxHoopChance(seed, ordinal),
            roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
          const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) =>
            luxBeamBirthOffset(v, chance);
          const life = sample(p.life)[0];
          if (age >= life) continue;
          const phase = age / life,
            spawn = new Vector3(...sample(p.spawnOffset)),
            velocity = new Vector3(...sample(p.velocity)),
            turn = new Quaternion(),
            rotation = new Quaternion();
          p.spawnAngles.forEach((v, i) => {
            rotation.setFromAxisAngle(
              new Vector3(...p.spawnAxes[i]).normalize(),
              (sample(v)[0] * Math.PI) / 180
            );
            turn.multiply(rotation);
          });
          spawn.applyQuaternion(turn);
          velocity.applyQuaternion(turn);
          const motion = garenQGroundMotion(
              velocity.toArray(),
              sample(p.drag),
              sample(p.worldAcceleration),
              life,
              age
            ),
            origin = sample(p.position),
            size = sample(p.size),
            scroll = sample(p.scroll),
            uvOffset = sample(p.uvOffset),
            scale = size.map((v, i) => v * sampleParticleCurve(p.scale, phase, i));
          if (p.uniform) scale.fill(scale[0]);
          particles.push({
            castTick: record.startTick,
            startTick: attack.startTick,
            eventTick: event.tick,
            bornTick: event.tick + born,
            point: event.point,
            facing: event.facing,
            profileIndex,
            ordinal,
            age,
            life,
            phase,
            offset: origin.map((v, i) => v + spawn.getComponent(i) + motion.offset[i]),
            travel: motion.travel,
            scale,
            rotation: sample(p.rotation),
            color: [0, 1, 2, 3].map((i) => sampleParticleCurve(p.color, phase, i)),
            lookup: particleColorLookup(p, phase, roll, motion.travel),
            scroll: scroll.map((v, i) => v * age + uvOffset[i]),
            frame:
              (p.atlas.start + (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0)) %
              (p.atlas.grid[0] * p.atlas.grid[1]),
          });
        }
        return particles;
      })
    )
  );
}
