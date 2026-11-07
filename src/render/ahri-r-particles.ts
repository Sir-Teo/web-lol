import data from '../content/ahri-r-particles.json';
import { rPaletteBinding } from './ahri-r-palette';
import { rEyeBirthEvents } from './ahri-r-eye-schedule';
import { rLayoutGlowBirthEvents } from './ahri-r-layout-glow-schedule';
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
import { AHRI_R_POLICY } from '../content/ahri-r-policy';
import { sourceParticlePostRotation } from './source-particle-post-rotation';
import { SourceMotionTimeline } from './source-motion-timeline';
import { SourceNoiseFieldValues } from './source-noise-field-values';
import { SourceNoiseMotionTimeline, SourceNoiseSchedule } from './source-noise-motion-timeline';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipsePeak } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import type { SurfaceParticle } from './source-particle-surfaces';

export const AHRI_R_PROFILES = data.profiles;
export type AhriRSystem = 'Ahri_R_mis_02' | 'Ahri_R_Tar' | 'Ahri_R_Eyes' | 'Ahri_R_Ready_tar';
export interface AhriRRoot {
  x: number;
  y: number;
  height: number;
  facing: number;
}
export interface AhriRParticleContext {
  root(time: number): AhriRRoot;
  boundObjectSize: number;
  /** Restrict work to an explicitly selected producer subset, before any roots
   * or kernels are evaluated. Omission uses the currently bound profiles;
   * an explicit subset can opt into prepared, still-unbound profiles. */
  profiles?: readonly number[];
}
const fixedContext: AhriRParticleContext = {
  root: () => ({ x: 0, y: 0, height: 0, facing: 0 }),
  boundObjectSize: 100,
};
/** Explicit local bindings; native clocks, actor roots and random streams remain unverified. */
export const AHRI_R_PARTICLE_ADAPTER = {
  hz: 60,
  firstUpdateTick: 1,
  cylinderVolumeFlag: 1,
  lifetimeKind: 0,
  delayGrid: 'nearest tick',
  stopBirths: 'immediate',
  boundObjectSizeDefault: 100,
  missingPaletteTexture: 'neutral-white local shader input; native global input unresolved',
  sharedRandomFlagOne: 'fixed cosmetic emitter chance; native random stream unverified',
  neutralLiveTables: 'empty tables with single 1',
} as const;
/** Eye and selected layout profiles use the explicit skin-buff producer. */
export const AHRI_R_BOUND_BUFF_PROFILES = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54] as const;
export const AHRI_R_PREPARED_EYE_TRAIL_PROFILES = [47, 48] as const;
/** Prepared layouts use the complete source path retained for finite binding. */
export const AHRI_R_PREPARED_LAYOUT_PROFILES = [49, 50, 51, 52, 53, 54] as const;
export const AHRI_R_PREPARED_NOISE_PROFILES = [10, 27] as const;
const noiseProfiles = new Set<number>(AHRI_R_PREPARED_NOISE_PROFILES);
const periodicProfiles = new Set<number>(AHRI_R_PREPARED_EYE_TRAIL_PROFILES);
const activeOnlyLayoutProfiles = new Set([51, 52, 54]);
for (const [slot, index] of [51, 52, 54].entries()) {
  const p = data.profiles[index];
  if (
    p.system !== 'Ahri_R_Ready_tar' ||
    p.name !== ['Alpha_Swooshies', 'Light_Swooshies1', 'Light_Swooshies2'][slot] ||
    p.kind !== 'mesh' ||
    p.mesh !== 'assets/effects/ahri-r-0216531e0d20ebea.glb' ||
    p.single ||
    p.emitterLife !== null ||
    p.period !== null ||
    p.timeActiveDuringPeriod !== 30 ||
    p.delay !== 0 ||
    p.rate.authoredKeyCount !== 0 ||
    p.rate.constant[0] !== [4, 7, 7][slot] ||
    p.rate.probabilities.length !== 0 ||
    p.life.authoredKeyCount !== 0 ||
    p.life.constant[0] !== 1 ||
    p.life.probabilities.length !== 0 ||
    [...p.bindingRequirements].sort().join(',') !==
      'emitter-lifetime,emitter-period-policy,soft-depth-input'
  )
    throw Error('R active-only layout mesh profile closure differs');
}
/** Deferred profiles stay in published data without entering the sampler. */
export const AHRI_R_SPELL_PROFILE_BINDINGS = data.profiles.map((p, profileIndex) => ({
  profileIndex,
  system: p.system,
  name: p.name,
  reason:
    p.role === 'unjoined'
      ? 'unjoined-native-producer'
      : AHRI_R_BOUND_BUFF_PROFILES.some((index) => index === profileIndex)
        ? 'bound-buff-profile'
        : !['Ahri_R_mis_02', 'Ahri_R_Tar'].includes(p.system)
          ? 'persistent-producer-not-connected'
          : (p.bindingRequirements as readonly string[]).includes('noise-field-arithmetic')
            ? 'noise-field-arithmetic-unresolved'
            : (p.bindingRequirements as readonly string[]).includes('native-palette-field') &&
                !rPaletteBinding(p)
              ? 'native-palette-field-unresolved'
              : 'bound-spell-profile',
}));
export const AHRI_R_BOUND_SPELL_PROFILES = AHRI_R_SPELL_PROFILE_BINDINGS.filter(
  (p) => p.reason === 'bound-spell-profile'
).map((p) => p.profileIndex);
const boundProfiles = new Set(AHRI_R_BOUND_SPELL_PROFILES);
const defaultProfiles = new Set<number>([
  ...AHRI_R_BOUND_SPELL_PROFILES,
  ...AHRI_R_BOUND_BUFF_PROFILES,
]);
for (const [offset, index] of [45, 46].entries()) {
  const profile = data.profiles[index];
  if (
    profile.system !== 'Ahri_R_Eyes' ||
    profile.name !== ['Temp_GroundGlow', 'Temp_GroundGlow1'][offset] ||
    profile.bindingRequirements.length !== 0 ||
    profile.emitterLife !== 50 ||
    eclipsePeak(profile.life) !== 2
  )
    throw Error('R finite eye-glow profile closure differs');
}
const preparedProfiles = new Set<number>([
  ...boundProfiles,
  ...AHRI_R_BOUND_BUFF_PROFILES,
  ...AHRI_R_PREPARED_EYE_TRAIL_PROFILES,
  ...AHRI_R_PREPARED_LAYOUT_PROFILES,
  ...AHRI_R_PREPARED_NOISE_PROFILES,
]);
const layout = data.profiles[50];
const base = data.profiles[49];
if (
  base.system !== 'Ahri_R_Ready_tar' ||
  base.name !== 'base1' ||
  base.kind !== 'quad' ||
  !base.single ||
  base.emitterLife !== null ||
  base.delay !== 0 ||
  base.period !== null ||
  base.timeActiveDuringPeriod !== null ||
  base.linger !== null ||
  base.life.authoredKeyCount !== 0 ||
  base.life.constant[0] !== 60 ||
  base.life.probabilities.length !== 0 ||
  base.bind.authoredKeyCount !== 0 ||
  base.bind.constant[0] !== 1 ||
  base.bind.probabilities.length !== 0 ||
  base.bindingRequirements.join(',') !== 'emitter-lifetime'
)
  throw Error('R sixty-second layout base closure differs');
if (
  layout.system !== 'Ahri_R_Ready_tar' ||
  layout.name !== 'base7' ||
  layout.kind !== 'quad' ||
  !layout.single ||
  layout.emitterLife !== null ||
  layout.delay !== 0 ||
  layout.life.authoredKeyCount !== 0 ||
  layout.life.constant[0] !== 10 ||
  layout.life.probabilities.length !== 0 ||
  layout.bind.authoredKeyCount !== 0 ||
  layout.bind.constant[0] !== 1 ||
  layout.bind.probabilities.length !== 0 ||
  layout.bindingRequirements.join(',') !== 'emitter-lifetime'
)
  throw Error('R finite layout profile closure differs');
const limits: Record<AhriRSystem, number> = {
  Ahri_R_mis_02: AHRI_R_POLICY.maximumBoltTicks / 60,
  Ahri_R_Eyes: 50,
  // Finite profile 50 uses its single-particle lifetime rewrite; meshes
  // preserve an authored thirty-second active-only window. Profile 53 bypasses
  // this finite replay bound through its recent-birth adapter.
  Ahri_R_Ready_tar: 30,
  Ahri_R_Tar: Math.max(
    ...data.profiles.filter((p) => p.system === 'Ahri_R_Tar').map((p) => p.emitterLife ?? 0)
  ),
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
interface RParticleUv {
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
function uvLayer(p: RParticleUv) {
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
function surfaceUv(p: RParticleUv, d: SourceUvDraw) {
  return {
    scale: [d.scaleU, d.scaleV],
    offset: [d.offsetU, d.offsetV],
    cell: [d.cellU, d.cellV],
    cellSize: [1 / p.divisions[0], 1 / p.divisions[1]],
    address: p.address,
  };
}
const prepared = data.profiles.map((p, profileIndex) => {
  if (!preparedProfiles.has(profileIndex)) return null;
  if (
    noiseProfiles.has(profileIndex) &&
    (p.name !== (profileIndex === 10 ? 'sparkles_burst' : 'sparks') ||
      p.system !== (profileIndex === 10 ? 'Ahri_R_Tar' : 'Ahri_R_mis_02') ||
      p.emitterLife !== (profileIndex === 10 ? 2.5 : 5) ||
      p.delay !== 0 ||
      p.single !== (profileIndex === 10) ||
      p.period !== null ||
      p.timeActiveDuringPeriod !== null ||
      !p.fieldCollection ||
      [...p.bindingRequirements].sort().join(',') !== 'field-defaults,noise-field-arithmetic')
  )
    throw Error('R prepared noise profile closure differs');
  if (
    (p.period !== null || p.timeActiveDuringPeriod !== null) &&
    !periodicProfiles.has(profileIndex) &&
    !activeOnlyLayoutProfiles.has(profileIndex)
  )
    throw Error('R spell profile needs an explicit periodic adapter');
  const geometry: SourceAppearanceGeometry =
    p.kind === 'trail'
      ? p.trail!.cameraFacing
        ? 'camera-trail'
        : 'arbitrary-trail'
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
      period:
        p.period === null && p.timeActiveDuringPeriod === null
          ? null
          : { length: p.period, active: p.timeActiveDuringPeriod },
    },
    variableStart: false,
    maxPerFrame: 0,
    segmentLimit: null,
    rateScale: 1,
  };
  const maximumLife = Math.fround(eclipsePeak(p.life));
  return {
    scheduleDefinition,
    maximumLife,
    noise: noiseProfiles.has(profileIndex)
      ? new SourceNoiseSchedule(
          new SourceNoiseFieldValues(p.fieldCollection),
          p.emitterLife!,
          Math.ceil((p.emitterLife! + maximumLife) * 60) + 2
        )
      : null,
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
    mult: p.multiplier ? uvLayer(p.multiplier.uv) : null,
    erosion: p.erosion ? new SourceValue(p.erosion.drive) : null,
    tiling: p.trail ? new SourceValue(p.trail.tiling) : null,
  };
});
export type AhriRParticle = SurfaceParticle & {
  tiling: number[] | null;
  sourceBind: number;
  sharedChance: number;
  sourceBasis: Float32Array | null;
};
/** Pure seeks over source-referenced birth/motion/appearance/UV kernels. The
 * fixed 60 Hz update grid, indexed cosmetic draws and capped total-life stop
 * policy are explicit local bindings. No World IDs/RNG or actor state changes. */
function sampleParticles(
  system: AhriRSystem,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  cache?: Map<string, HeldBirth>,
  context: AhriRParticleContext = fixedContext,
  schedules?: Map<number, BirthEvent[]>
): AhriRParticle[] {
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
    if (
      context.profiles
        ? !context.profiles.includes(profileIndex)
        : !defaultProfiles.has(profileIndex)
    )
      return [];
    const d = prepared[profileIndex];
    if (!d) return [];
    const particles: AhriRParticle[] = [];
    const periodic = periodicProfiles.has(profileIndex),
      activeOnly = activeOnlyLayoutProfiles.has(profileIndex),
      continuous = profileIndex === 53,
      recent = periodic || continuous;
    let births = periodic
      ? rEyeBirthEvents(profileIndex, time)
      : continuous
        ? rLayoutGlowBirthEvents(whole)
        : schedules?.get(profileIndex);
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
    // Active-only mesh schedules contain at most 200 births. Retain only live
    // candidates in the expensive motion/binding cache; keep their original
    // kernel birth clocks, phase and finite pool ordinals unchanged.
    if (activeOnly)
      births = births.filter(
        (event) => event.updateTick >= whole - Math.ceil(d.maximumLife * 60) - 1
      );
    if ((recent || activeOnly) && cache) {
      const wanted = new Set(births.map((event) => `${profileIndex}:${event.ordinal + 1}`));
      for (const key of cache.keys())
        if (key.startsWith(profileIndex + ':') && !wanted.has(key)) cache.delete(key);
    }
    for (const event of births) {
      if (event.updateTick > whole || event.updateTick / 60 >= stopSeconds) break;
      const ordinal = event.ordinal + 1,
        // Rebase only recent periodic/continuous particles. Their emitter phase remains
        // absolute, but per-particle float32 clocks must not lose sub-tick
        // precision as an extended buff's system age grows.
        origin = recent ? Math.floor(event.time) : 0,
        birthTime = Math.fround(recent ? event.time - origin : event.time),
        age = recent ? time - origin - birthTime : time - birthTime;
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
                      ((p.shape.flags ?? 0) & AHRI_R_PARTICLE_ADAPTER.cylinderVolumeFlag) !== 0,
                  }
                : {
                    kind: 'cylinder',
                    radius: p.shape.radius ?? 0,
                    height: p.shape.height ?? 0,
                    volume:
                      ((p.shape.flags ?? 0) & AHRI_R_PARTICLE_ADAPTER.cylinderVolumeFlag) !== 0,
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
            recent ? event.updateTick / 60 - origin : event.updateTick / 60,
            (time) => {
              const root = context.root(recent ? time + origin : time);
              return [root.x, root.height, root.y];
            },
            Math.ceil(born.lifetime * 60) + 2
          ),
          chance,
          roll,
          uv: d.uv.birth(event.phase, chance, roll),
          mult: d.mult?.birth(event.phase, chance, roll) ?? null,
          motion: d.noise
            ? new SourceNoiseMotionTimeline(
                placement.position,
                placement.velocity,
                born.drag,
                Math.ceil(born.lifetime * 60) + 2,
                event.updateTick,
                mixed >>> 0,
                d.noise
              )
            : new SourceMotionTimeline(
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
        recent ? stopSeconds - origin : stopSeconds,
        p.linger ?? 0
      );
      const offset = Array.from(moved.position),
        orbit = sourceParticleOrbit(held.orbital, age);
      if (orbit) {
        if (
          held.orbital[0] !== 0 ||
          held.orbital[2] !== 0 ||
          p.kind !== 'billboard' ||
          system !== 'Ahri_R_Tar'
        )
          throw Error('Unsupported R orbital frame');
        const [x, y, z] = offset;
        for (let axis = 0; axis < 3; axis++)
          offset[axis] = Math.fround(
            orbit[axis * 3] * x + orbit[axis * 3 + 1] * y + orbit[axis * 3 + 2] * z
          );
      }
      const root = context.root(p.particleLocal ? time : recent ? origin + birthTime : birthTime);
      let vx = -travel[0],
        vy = travel[1],
        vz = travel[2];
      if (p.local) {
        if (system === 'Ahri_R_mis_02') [vy, vz] = [-vz, vy];
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
  motion: SourceMotionTimeline | SourceNoiseMotionTimeline;
  binding: SourceBindingTimeline;
  orbital: Float32Array;
}
/** Each live presentation root owns its cache. Clearing it cannot change a seek. */
export class AhriRParticleSampler {
  private cache = new Map<string, HeldBirth>();
  private schedules = new Map<number, BirthEvent[]>();
  constructor(
    private system: AhriRSystem,
    private seed: number,
    private context: AhriRParticleContext = fixedContext
  ) {
    if (
      !Object.hasOwn(limits, system) ||
      !Number.isInteger(seed) ||
      !Number.isFinite(context.boundObjectSize) ||
      context.boundObjectSize <= 0 ||
      typeof context.root !== 'function'
    )
      throw RangeError('Invalid R particle sampler identity');
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
export function ahriRParticles(
  system: AhriRSystem,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  context: AhriRParticleContext = fixedContext
) {
  return sampleParticles(system, seed, time, stopSeconds, undefined, context);
}
