import data from '../content/ahri-e-particles.json';
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
import { SourceBindingTimeline } from './source-binding-timeline';
import { sourceParticleOrbit, sourceParticleStretch } from './source-particle-draw-values';
import { AHRI_E_POLICY } from '../content/ahri-e-policy';
import { AHRI_E } from '../content/ahri-e';
import { sourceParticlePostRotation } from './source-particle-post-rotation';
import { SourceMotionTimeline } from './source-motion-timeline';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipsePeak } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { particleHalf } from './particle-half';
import type { SurfaceParticle } from './source-particle-surfaces';

export const AHRI_E_PROFILES = data.profiles;
export type AhriESystem = 'Ahri_E_cas' | 'Ahri_E_mis' | 'Ahri_E_tar' | 'Ahri_E_buf' | '{44fc6ec4}';
export interface AhriERoot {
  x: number;
  y: number;
  height: number;
  facing: number;
}
export interface AhriEParticleContext {
  root(time: number): AhriERoot;
  boundObjectSize: number;
}
const fixedContext: AhriEParticleContext = {
  root: () => ({ x: 0, y: 0, height: 0, facing: 0 }),
  boundObjectSize: 100,
};
/** Explicit local bindings; native clocks, actor roots and random streams remain unverified. */
export const AHRI_E_PARTICLE_ADAPTER = {
  hz: 60,
  firstUpdateTick: 1,
  cylinderVolumeFlag: 1,
  lifetimeKind: 0,
  delayGrid: 'nearest tick',
  stopBirths: 'immediate',
  boundObjectSizeDefault: 100,
  neutralLiveTables: 'empty tables with single 1',
} as const;
const limits: Record<AhriESystem, number> = {
  Ahri_E_cas: 1,
  Ahri_E_mis: Math.ceil((AHRI_E_POLICY.range / AHRI_E.missile.speed) * 60) / 60,
  Ahri_E_tar: 2.5,
  Ahri_E_buf: Math.max(...AHRI_E.charmSecondsByRank),
  '{44fc6ec4}': Math.max(...AHRI_E.charmSecondsByRank),
};
function neutral<T extends SourceValueDefinition>(definition: T): T {
  if (definition.probabilities.some((p) => p.times.length || p.values.length || p.single !== 1))
    throw Error('E live tables need an explicit flicker adapter');
  return { ...definition, probabilities: [] };
}
const zero = (constant: number[]): SourceValueDefinition => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const empty3 = [0, 0, 0];
interface EParticleUv {
  scale: SourceValueDefinition;
  offset: SourceValueDefinition;
  birthScroll: SourceValueDefinition;
  scroll: SourceValueDefinition;
  emitterScroll: readonly number[];
  divisions: readonly number[];
  frames: number;
  startFrame: number;
  frameRate: number;
  randomStart: boolean;
  clamp: boolean;
  address: number;
}
function uvLayer(p: EParticleUv) {
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
      rate: p.frameRate,
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
function surfaceUv(p: EParticleUv, d: SourceUvDraw) {
  return {
    scale: [d.scaleU, d.scaleV],
    offset: [d.offsetU, d.offsetV],
    cell: [d.cellU, d.cellV],
    cellSize: [1 / p.divisions[0], 1 / p.divisions[1]],
    address: p.address,
  };
}
const prepared = data.profiles.map((p) => {
  if (p.multiplier !== null) throw Error('Unsupported E multiplier closure');
  const geometry: SourceAppearanceGeometry =
    p.kind === 'trail'
      ? p.trail!.cameraFacing
        ? 'camera-trail'
        : 'arbitrary-trail'
      : p.kind === 'ray'
        ? 'quad'
        : p.kind === 'skin'
          ? 'mesh'
          : (p.kind as 'billboard' | 'quad' | 'mesh');
  const scheduleDefinition = {
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
  };
  return {
    scheduleDefinition,
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
      p.shape.kind === 'cylinder' || p.shape.kind === 'sphere'
        ? null
        : new SourceLegacySpawnShape({
            offset: p.shape.offset,
            angles: p.shape.angles,
            axes: p.shape.axes,
          }),
    appearance: new SourceParticleAppearance({
      scale: neutral(p.scale),
      color: neutral(p.color),
      uniform: p.uniform,
      geometry,
      modulation: [1, 1, 1, 1],
    }),
    spin: new SourceParticleSpin({ enabled: p.rotationEnabled === 1, rotation: p.liveRotation }),
    orbital: new SourceValue(p.orbitalVelocity),
    acceleration: new SourceIntegratedValue(p.worldAcceleration),
    uv: uvLayer(p.uv),
    mult: null,
    erosion: p.erosion ? new SourceValue(p.erosion.drive) : null,
    tiling: p.trail ? new SourceValue(p.trail.tiling) : null,
  };
});
export type AhriEParticle = SurfaceParticle & {
  tiling: number[] | null;
  sourceBind: number;
  sharedChance: number;
  sourceBasis: Float32Array | null;
};
/** Pure seeks over source-referenced birth/motion/appearance/UV kernels. The
 * fixed 60 Hz update grid, indexed cosmetic draws and capped total-life stop
 * policy are explicit local bindings. No World IDs/RNG or actor state changes. */
function sampleParticles(
  system: AhriESystem,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  cache?: Map<string, HeldBirth>,
  context: AhriEParticleContext = fixedContext,
  schedules?: Map<number, BirthEvent[]>
): AhriEParticle[] {
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
    if (p.system !== system) return [];
    const d = prepared[profileIndex];
    if (!d) return [];
    const particles: AhriEParticle[] = [];
    let births = schedules?.get(profileIndex);
    if (!births) {
      const schedule = new SourceEmitterSchedule(d.scheduleDefinition);
      births = [];
      for (let tick = 1; tick <= Math.ceil(limits[system] * 60); tick++)
        for (const birth of schedule.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () =>
          luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x9e3779b9), tick)
        ))
          births.push({ ...birth, updateTick: tick });
      schedules?.set(profileIndex, births);
    }
    for (const event of births) {
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
        const drawn = draw(),
          chance =
            p.sharedRandomValue === 1
              ? luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b), 0)
              : drawn,
          born = d.birth.sample(event.phase, draw);
        const life = stopped ? Math.min(born.lifetime, Math.max(p.linger ?? 0, 0)) : born.lifetime;
        if (age < -1e-6 || age >= life || life <= 0) continue;
        const roll = draw();
        const shape = d.shape
          ? d.shape.sample(event.phase, draw)
          : sourceSpawnShape(
              p.shape.kind === 'sphere'
                ? {
                    kind: 'sphere',
                    radius: p.shape.radius ?? 0,
                    volume:
                      ((p.shape.flags ?? 0) & AHRI_E_PARTICLE_ADAPTER.cylinderVolumeFlag) !== 0,
                  }
                : {
                    kind: 'cylinder',
                    radius: p.shape.radius ?? 0,
                    height: p.shape.height ?? 0,
                    volume:
                      ((p.shape.flags ?? 0) & AHRI_E_PARTICLE_ADAPTER.cylinderVolumeFlag) !== 0,
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
          offsetScale:
            p.flex?.scaleEmitOffsetByBoundObjectSize === undefined
              ? 1
              : p.flex.scaleEmitOffsetByBoundObjectSize * context.boundObjectSize,
        });
        held = {
          born,
          orbital: p.explicitFields.includes('birthOrbitalVelocity')
            ? d.orbital.drawChannels(event.phase, draw)
            : new Float32Array(3),
          binding: new SourceBindingTimeline(
            p.bind,
            born.lifetime,
            birthTime,
            event.updateTick / 60,
            (time) => {
              const root = context.root(time);
              return [root.x, root.height, root.y];
            },
            Math.ceil(born.lifetime * 60) + 2
          ),
          chance,
          roll,
          uv: d.uv.birth(event.phase, chance, roll),
          mult: null,
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
        instanceScale:
          p.flex?.scaleBirthScaleByBoundObjectSize === undefined
            ? 1
            : p.flex.scaleBirthScaleByBoundObjectSize * context.boundObjectSize,
      });
      const uv = d.uv.sample(held.uv, age, life, time),
        acceleration = d.acceleration.sample(phase, 2),
        travel = Array.from(moved.moving);
      const binding = held.binding.sample(
        whole - event.updateTick,
        fraction,
        stopSeconds,
        p.linger ?? 0
      );
      const offset = Array.from(moved.position),
        orbit = sourceParticleOrbit(held.orbital, age);
      if (orbit) {
        if (
          held.orbital[0] !== 0 ||
          held.orbital[2] !== 0 ||
          p.kind !== 'billboard' ||
          p.role !== 'hit'
        )
          throw Error('Unsupported E orbital frame');
        const [x, y, z] = offset;
        for (let axis = 0; axis < 3; axis++)
          offset[axis] = Math.fround(
            orbit[axis * 3] * x + orbit[axis * 3 + 1] * y + orbit[axis * 3 + 2] * z
          );
      }
      const root = context.root(p.particleLocal ? time : birthTime);
      let vx = -travel[0],
        vy = travel[1],
        vz = travel[2];
      if (p.local) {
        if (p.role === 'flight') [vy, vz] = [-vz, vy];
        const c = Math.cos(root.facing),
          s = Math.sin(root.facing);
        [vx, vz] = [vx * c + vz * s, -vx * s + vz * c];
      }
      const worldVelocity = [
        vx + binding.velocity[0],
        vy + binding.velocity[1],
        vz + binding.velocity[2],
      ];
      const stretch = sourceParticleStretch(
        p.kind as 'billboard',
        worldVelocity,
        p.directionVelocityScale ?? 0,
        p.directionVelocityMinScale ?? 1
      );
      const size = Array.from(appearance.scale);
      if (p.kind === 'quad') size[0] *= stretch;
      const lookup = particleColorLookup(p, phase, roll, worldVelocity);
      if (p.kind === 'ray') {
        lookup[0] = particleHalf(lookup[0]);
        lookup[1] = particleHalf(lookup[1]);
      }
      const rotation = d.spin.sample({
        birthRotation: born.rotation,
        angularVelocity: born.angularVelocity,
        angularAcceleration: empty3,
        age,
        life,
        lingering: stopped,
      });
      particles.push({
        profileIndex,
        ordinal,
        bornTick: event.time * 60,
        age,
        naturalLife,
        life,
        phase,
        offset,
        worldOffset: [
          acceleration[0] * life * life - binding.bound[0],
          acceleration[1] * life * life + binding.bound[1],
          acceleration[2] * life * life + binding.bound[2],
        ],
        worldTravel: [-binding.velocity[0], binding.velocity[1], binding.velocity[2]],
        size,
        color: Array.from(appearance.color),
        rotation: Array.from(rotation),
        sourceBasis:
          p.postRotateOrientation.enabled === 1
            ? sourceParticlePostRotation(rotation, p.postRotateOrientation.axis!)
            : null,
        spawnTurn: [0, 0, 0, 1],
        travel,
        stretch,
        bind: 0,
        sourceBind: d.bind.sample(phase)[0],
        sharedChance: chance,
        lookup,
        uv: surfaceUv(p.uv, uv),
        multUv: null,
        erosion: d.erosion?.sample(phase)[0] ?? 0,
        tiling: d.tiling?.drawShared(event.phase, chance) ?? null,
      });
    }
    return particles;
  });
}

type BirthEvent = {
  ordinal: number;
  time: number;
  share: number;
  phase: number;
  updateTick: number;
};

interface HeldBirth {
  born: ReturnType<SourceBirthValues['sample']>;
  chance: number;
  roll: number;
  uv: ReturnType<SourceUvLayer['birth']>;
  mult: ReturnType<SourceUvLayer['birth']> | null;
  motion: SourceMotionTimeline;
  binding: SourceBindingTimeline;
  orbital: Float32Array;
}
/** Each live presentation root owns its cache. Clearing it cannot change a seek. */
export class AhriEParticleSampler {
  private cache = new Map<string, HeldBirth>();
  private schedules = new Map<number, BirthEvent[]>();
  constructor(
    private system: AhriESystem,
    private seed: number,
    private context: AhriEParticleContext = fixedContext
  ) {
    if (
      !Object.hasOwn(limits, system) ||
      !Number.isInteger(seed) ||
      !Number.isFinite(context.boundObjectSize) ||
      context.boundObjectSize <= 0 ||
      typeof context.root !== 'function'
    )
      throw RangeError('Invalid E particle sampler identity');
  }
  get cachedBirths() {
    return this.cache.size;
  }
  get computedMotionSteps() {
    return [...this.cache.values()].reduce((n, b) => n + b.motion.computedSteps, 0);
  }
  get computedBindingSteps() {
    return [...this.cache.values()].reduce((n, b) => n + b.binding.computedSteps, 0);
  }
  sample(time: number, stopSeconds = Infinity) {
    return sampleParticles(
      this.system,
      this.seed,
      time,
      stopSeconds,
      this.cache,
      this.context,
      this.schedules
    );
  }
  dispose() {
    this.cache.clear();
    this.schedules.clear();
  }
}
export function ahriEParticles(
  system: AhriESystem,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  context: AhriEParticleContext = fixedContext
) {
  return sampleParticles(system, seed, time, stopSeconds, undefined, context);
}
