import data from '../content/ahri-q-projectile-particles.json';
import { SourceValue, type SourceValueDefinition } from './source-value';
import { SourceBirthValues } from './source-birth-values';
import { SourceLegacySpawnShape } from './source-legacy-spawn-shape';
import { sourceSpawnShape } from './source-spawn-shape';
import { sourceBirthPlacement } from './source-birth-placement';
import {
  SourceParticleAppearance,
  type SourceAppearanceGeometry,
} from './source-particle-appearance';
import { SourceParticleSpin } from './source-particle-spin';
import { SourceIntegratedValue } from './source-integrated-value';
import { SourceEmitterSchedule } from './source-emitter-schedule';
import { SourceUvLayer, type SourceUvDraw } from './source-uv-layer';
import { SourceMotionTimeline } from './source-motion-timeline';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipsePeak } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { particleHalf } from './particle-half';
import type { SurfaceParticle } from './source-particle-surfaces';

export const AHRI_Q_PROJECTILE_PROFILES = data.profiles;
export type AhriQProjectileRole = 'missile' | 'return';
/** Explicit current adapter choices. Native Q callback cadence, constructor
 * defaults, PRNG and cylinder flag dispatch are not certified by these kernels. */
export const AHRI_Q_PROJECTILE_ADAPTER = {
  hz: 60,
  firstUpdateTick: 1,
  cylinderVolumeFlag: 1,
  lifetimeKind: 0,
  delayGrid: 'nearest tick',
} as const;
const zero = (constant: number[]): SourceValueDefinition => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const empty3 = [0, 0, 0];
function uvLayer(p: (typeof data.profiles)[number]['uv']) {
  return new SourceUvLayer({
    scale: p.scale,
    rotation: zero([0]),
    birthOffset: p.offset,
    birthScrollRate: p.birthScroll,
    birthRotateRate: zero([0]),
    birthFrameRate: zero([1]),
    scrollRate: p.scroll,
    rotateRate: zero([0]),
    book: {
      divisions: p.divisions,
      frames: p.frames,
      start: p.startFrame,
      rate: 0,
      randomStart: p.randomStart,
    },
    center: [0.5, 0.5],
    emitterScrollRate: p.emitterScroll,
    flipU: false,
    flipV: false,
    scrollClamp: p.clamp,
    addressMode: p.address as 0 | 1 | 2,
  });
}
function surfaceUv(p: (typeof data.profiles)[number]['uv'], d: SourceUvDraw) {
  return {
    scale: [d.scaleU, d.scaleV],
    offset: [d.offsetU, d.offsetV],
    cell: [d.cellU, d.cellV],
    cellSize: [1 / p.divisions[0], 1 / p.divisions[1]],
    address: p.address,
  };
}
const prepared = data.profiles.map((p) => {
  if (p.rate.probabilities.length)
    throw Error('Q projectile rate probability needs explicit scheduling');
  const geometry: SourceAppearanceGeometry =
    p.kind === 'trail'
      ? p.trail!.cameraFacing
        ? 'camera-trail'
        : 'arbitrary-trail'
      : p.kind === 'ray'
        ? 'quad'
        : (p.kind as 'billboard' | 'quad' | 'mesh');
  const schedule = new SourceEmitterSchedule({
    rate: p.rate,
    window: {
      lifetime: p.emitterLife,
      particleLifetimeMaximum: eclipsePeak(p.life),
      simple: false,
      singleParticle: p.single,
      overridesMaterials: false,
      delay: Math.round(p.delay * 60) / 60,
      emitterLinger: p.emitterLinger ?? 0,
      period: null,
    },
    variableStart: false,
    maxPerFrame: 0,
    segmentLimit: null,
    rateScale: 1,
  });
  const births = [];
  for (let tick = 1; tick <= Math.ceil(p.emitterLife * 60); tick++)
    for (const birth of schedule.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0))
      births.push({ ...birth, updateTick: tick });
  return {
    births,
    maximumLife: Math.fround(eclipsePeak(p.life)),
    birth: new SourceBirthValues({
      lifetime: p.life,
      velocity: p.velocity,
      rotation: p.rotation,
      angularVelocity: p.spin,
      scale: p.size,
      drag: p.drag,
      color: p.birthColor,
    }),
    position: new SourceValue(p.position),
    bind: new SourceValue(p.bind),
    shape:
      p.shape.kind === 'cylinder'
        ? null
        : new SourceLegacySpawnShape({
            offset: p.shape.offset,
            angles: p.shape.angles,
            axes: p.shape.axes,
          }),
    appearance: new SourceParticleAppearance({
      scale: p.scale,
      color: p.color,
      uniform: p.uniform,
      geometry,
      modulation: [1, 1, 1, 1],
    }),
    spin: new SourceParticleSpin({ enabled: false, rotation: zero(empty3) }),
    acceleration: new SourceIntegratedValue(p.worldAcceleration),
    uv: uvLayer(p.uv),
    mult: p.multiplier ? uvLayer(p.multiplier.uv) : null,
    erosion: p.erosion ? new SourceValue(p.erosion.drive) : null,
    tiling: p.trail ? new SourceValue(p.trail.tiling) : null,
  };
});
export type AhriQProjectileParticle = SurfaceParticle & { tiling: number[] | null };
/** Pure seeks over source-referenced birth/motion/appearance/UV kernels. The
 * fixed 60 Hz update grid, indexed cosmetic draws and capped total-life stop
 * policy are explicit local bindings. No World IDs/RNG or actor state changes. */
function sampleParticles(
  role: AhriQProjectileRole,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  cache?: Map<string, HeldBirth>
): AhriQProjectileParticle[] {
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    !Number.isInteger(seed) ||
    Number.isNaN(stopSeconds) ||
    stopSeconds < 0
  )
    return [];
  const tick = time * 60,
    whole = Math.floor(tick + 1e-8),
    fraction = Math.max(0, Math.min(1, tick - whole)),
    stopped = time >= stopSeconds;
  return data.profiles.flatMap((p, profileIndex) => {
    if (p.role !== role) return [];
    const d = prepared[profileIndex],
      particles: AhriQProjectileParticle[] = [];
    for (const event of d.births) {
      if (event.updateTick > whole || event.updateTick / 60 >= stopSeconds) break;
      const ordinal = event.ordinal + 1,
        birthTime = Math.fround(event.time),
        age = time - birthTime;
      if (age >= d.maximumLife) continue;
      const key = profileIndex + ':' + ordinal;
      let held = cache?.get(key);
      if (!held) {
        let drawIndex = 0;
        const mixed =
            seed ^ Math.imul(profileIndex + 1, 0x85ebca6b) ^ Math.imul(ordinal, 0x27d4eb2d),
          draw = () => luxHoopChance(mixed, ++drawIndex);
        const chance = draw(),
          born = d.birth.sample(event.phase, draw);
        const life = stopped ? Math.min(born.lifetime, Math.max(p.linger ?? 0, 0)) : born.lifetime;
        if (age < -1e-6 || age >= life || life <= 0) continue;
        const roll = draw();
        const shape = d.shape
          ? d.shape.sample(event.phase, draw)
          : sourceSpawnShape(
              {
                kind: 'cylinder',
                radius: p.shape.radius,
                height: p.shape.height,
                volume: (p.shape.flags & AHRI_Q_PROJECTILE_ADAPTER.cylinderVolumeFlag) !== 0,
              },
              draw
            );
        const placement = sourceBirthPlacement({
          base: d.position.drawChannels(event.phase, draw),
          offset: shape.offset,
          turn: shape.turn,
          turned: shape.turned,
          velocity: born.velocity,
          acceleration: empty3,
          surface: null,
          surfaceScale: 1,
          useNormal: false,
          offsetScale: 1,
        });
        held = {
          born,
          chance,
          roll,
          uv: d.uv.birth(event.phase, chance, roll),
          mult: d.mult?.birth(event.phase, chance, roll) ?? null,
          motion: new SourceMotionTimeline(
            placement.position,
            placement.velocity,
            born.drag,
            Math.ceil(born.lifetime * 60) + 2
          ),
        };
        cache?.set(key, held);
      }
      const { born, chance, roll } = held,
        naturalLife = born.lifetime,
        life = stopped ? Math.min(naturalLife, Math.max(p.linger ?? 0, 0)) : naturalLife;
      if (age < -1e-6 || age >= life || life <= 0) continue;
      const phase = Math.max(0, Math.min(1, age / life)),
        moved = held.motion.sample(whole - event.updateTick, fraction);
      const appearance = d.appearance.sample({
        birthScale: born.scale,
        birthColor: born.color,
        age,
        life,
        instanceScale: 1,
      });
      const uv = d.uv.sample(held.uv, age, life, time),
        acceleration = d.acceleration.sample(phase, 2),
        travel = Array.from(moved.moving);
      const lookup = particleColorLookup(p, phase, roll, travel);
      if (p.kind === 'ray') {
        lookup[0] = particleHalf(lookup[0]);
        lookup[1] = particleHalf(lookup[1]);
      }
      particles.push({
        profileIndex,
        ordinal,
        bornTick: event.time * 60,
        age,
        naturalLife,
        life,
        phase,
        offset: Array.from(moved.position),
        worldOffset: Array.from(acceleration, (v) => v * life * life),
        worldTravel: [0, 0, 0],
        size: Array.from(appearance.scale),
        color: Array.from(appearance.color),
        rotation: Array.from(
          d.spin.sample({
            birthRotation: born.rotation,
            angularVelocity: born.angularVelocity,
            angularAcceleration: empty3,
            age,
            life,
            lingering: stopped,
          })
        ),
        spawnTurn: [0, 0, 0, 1],
        travel,
        stretch: 1,
        bind: d.bind.sample(phase)[0],
        lookup,
        uv: surfaceUv(p.uv, uv),
        multUv:
          d.mult && p.multiplier
            ? surfaceUv(p.multiplier.uv, d.mult.sample(held.mult!, age, life, time))
            : null,
        erosion: d.erosion?.sample(phase)[0] ?? 0,
        tiling: d.tiling?.drawShared(event.phase, chance) ?? null,
      });
    }
    return particles;
  });
}

interface HeldBirth {
  born: ReturnType<SourceBirthValues['sample']>;
  chance: number;
  roll: number;
  uv: ReturnType<SourceUvLayer['birth']>;
  mult: ReturnType<SourceUvLayer['birth']> | null;
  motion: SourceMotionTimeline;
}
/** Each live presentation root owns its cache. Clearing it cannot change a seek. */
export class AhriQProjectileSampler {
  private cache = new Map<string, HeldBirth>();
  constructor(
    private role: AhriQProjectileRole,
    private seed: number
  ) {
    if (!['missile', 'return'].includes(role) || !Number.isInteger(seed))
      throw RangeError('Invalid Q particle sampler identity');
  }
  get cachedBirths() {
    return this.cache.size;
  }
  get computedMotionSteps() {
    return [...this.cache.values()].reduce((n, b) => n + b.motion.computedSteps, 0);
  }
  sample(time: number, stopSeconds = Infinity) {
    return sampleParticles(this.role, this.seed, time, stopSeconds, this.cache);
  }
  dispose() {
    this.cache.clear();
  }
}
export function ahriQProjectileParticles(
  role: AhriQProjectileRole,
  seed: number,
  time: number,
  stopSeconds = Infinity
) {
  return sampleParticles(role, seed, time, stopSeconds);
}
