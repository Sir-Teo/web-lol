import { Vector3 } from 'three';
import source from '../content/gromp-attack.json';
import type { GrompAttackVisual } from '../simulation/types';
import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { grompDeathTravel } from './gromp-death-particles';

/** The saved path has post-step endpoints. A stopped record freezes at contact;
 * no trajectory is invented before the retained prefix. */
export function grompAttackFrame(effect: GrompAttackVisual, tick: number) {
  if (!Number.isFinite(tick) || !effect.frames.length || tick < effect.frames[0].tick) return null;
  for (let i = 1; i < effect.frames.length; i++) {
    const a = effect.frames[i - 1],
      b = effect.frames[i];
    if (tick > b.tick) continue;
    const t = (tick - a.tick) / (b.tick - a.tick),
      turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, facing: a.facing + turn * t };
  }
  const last = effect.frames.at(-1)!;
  return { x: last.x, y: last.y, facing: last.facing };
}

const sample = (keys: { time: number; value: number[] }[], phase: number, axis: number) =>
  keys.length
    ? sampleParticleCurve(
        { times: keys.map((k) => k.time), values: keys.map((k) => k.value) },
        phase,
        axis
      )
    : 1;

/** Source birth fields share one indexed chance; constant bind weight translates
 * particles by that fraction of emitter travel since birth. Stop uses the local
 * type-0 total-life cap; native legacy stop/binding conventions remain open. */
export function grompAttackParticles(effect: GrompAttackVisual, tick: number) {
  const now = tick - effect.launchTick,
    stop = effect.stopTick === null ? Infinity : effect.stopTick - effect.launchTick,
    current = grompAttackFrame(effect, tick);
  if (!Number.isFinite(tick) || now < 1 || !current) return [];
  return source.profiles.flatMap((p, profileIndex) => {
    const count = p.single
        ? now >= 1 && stop > 1
          ? Math.max(1, Math.trunc(p.rate))
          : 0
        : luxEmissionCount(p.rate, now, p.emitterLife ?? Infinity, stop),
      seed = effect.id ^ Math.imul(p.sourceIndex + 1, 0x85ebca6b),
      stopped = tick >= (effect.stopTick ?? Infinity),
      particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
        age = (now - born) / 60,
        chance = luxHoopChance(seed, ordinal),
        birthFrame = grompAttackFrame(effect, effect.launchTick + born);
      const birth = (
        value: number[],
        probabilities: Parameters<typeof luxBeamBirthOffset>[0]['probabilities']
      ) => luxBeamBirthOffset({ value, probabilities }, chance);
      const life = birth([p.life], [p.probabilities.life])[0];
      if (!birthFrame || age < 0 || age >= (stopped ? Math.min(life, p.linger) : life)) continue;
      const phase = age / life,
        velocity = new Vector3(...birth(p.velocity, p.probabilities.velocity)),
        offset = new Vector3(...birth(p.offset, p.probabilities.offset));
      for (const shape of p.shape) {
        const axis = new Vector3(...shape.axis).normalize(),
          angle = (birth([shape.value], [shape.probability])[0] * Math.PI) / 180;
        offset.applyAxisAngle(axis, angle);
        velocity.applyAxisAngle(axis, angle);
      }
      const facing = p.local ? birthFrame.facing : 0,
        c = Math.cos(facing),
        s = Math.sin(facing),
        motion = grompDeathTravel(velocity.toArray(), [0, 0, 0], p.drag, age),
        local = offset.toArray().map((v, axis) => v + motion.position[axis]),
        scale = birth(p.size, p.probabilities.size).map(
          (v, axis) => v * sample(p.scaleCurve, phase, axis)
        );
      if (p.uniform) scale.fill(scale[0]);
      particles.push({
        profileIndex,
        ordinal,
        birthTick: effect.launchTick + born,
        age,
        life,
        phase,
        birth: birthFrame,
        current,
        facing: p.particleLocal ? current.facing : facing,
        position: [
          birthFrame.x + c * local[0] + s * local[2] + p.bind * (current.x - birthFrame.x),
          local[1],
          birthFrame.y - s * local[0] + c * local[2] + p.bind * (current.y - birthFrame.y),
        ],
        scale,
        rotation: birth(p.rotation, p.probabilities.rotation),
        color: p.color.map((v, axis) => v * sample(p.colorCurve, phase, axis)),
      });
    }
    return particles;
  });
}
