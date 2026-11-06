import { BaronPreparedEmitter, type BaronBirthFactors } from './baron-prepared-emitter';
import {
  baronFlag,
  type BaronAttackProfile,
  type BaronAttackProgram,
  type BaronAttackRole,
} from './baron-attack-program';
import { ParticlePreviewRng } from './particle-preview-rng';
import { SourceEmitterSchedule, type SourceEmitterScheduleState } from './source-emitter-schedule';
import { sourceEmissionWindow } from './source-emission-window';
import { sourceBirthPlacement } from './source-birth-placement';
import { sourceSteppedMotion } from './source-stepped-motion';
import { sourceLifetimeSettlement } from './source-lifetime-settlement';
import type { SourceUvBirth } from './source-uv-layer';

const I = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  ZERO = new Float32Array(3);
function turn(matrix: ArrayLike<number>, value: ArrayLike<number>) {
  return Float32Array.from(
    { length: 3 },
    (_, axis) =>
      matrix[axis * 3] * value[0] +
      matrix[axis * 3 + 1] * value[1] +
      matrix[axis * 3 + 2] * value[2]
  );
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
interface Particle {
  emitter: number;
  serial: number;
  ordinal: number;
  birthTime: number;
  lifetime: number;
  lingerFrom: number | null;
  fresh: boolean;
  roll: number;
  position: Float32Array;
  velocity: Float32Array;
  acceleration: Float32Array;
  birthRotation: Float32Array;
  angularVelocity: Float32Array;
  birthScale: Float32Array;
  birthDrag: Float32Array;
  birthColor: Float32Array;
  anchor: Float32Array;
  frame: Float32Array;
  placed: Float32Array;
  bound: Float32Array;
  rotation: Float32Array;
  worldPosition: Float32Array;
  travel: Float32Array;
  standingFrame: Float32Array;
  uv: SourceUvBirth;
  multUv: SourceUvBirth | null;
  tiling: Float32Array;
  odometer: number;
}
interface EmitterState {
  prepared: BaronPreparedEmitter;
  schedule: SourceEmitterSchedule;
  chance: number | null;
  travelled: number;
  spawnedAt: number[] | null;
  finishedAt: number | null;
  position: Float32Array;
  frame: Float32Array;
}
export interface BaronSystemStep {
  dt: number;
  origin: readonly number[];
  moved: readonly number[];
  orientation: ArrayLike<number>;
  stopped: boolean;
}
export interface BaronSystemCheckpoint {
  version: 1;
  role: BaronAttackRole;
  now: number;
  steps: number;
  born: number;
  rng: number;
  emitters: {
    schedule: SourceEmitterScheduleState;
    chance: number | null;
    travelled: number;
    spawnedAt: number[] | null;
    finishedAt: number | null;
  }[];
  particles: Particle[];
}
export interface BaronSystemOptions {
  capacity: number;
  birthFactors?: (profile: Readonly<BaronAttackProfile>) => BaronBirthFactors;
}
/** Current format-2 Baron closure, explicit positive steps and a viewer-only RNG.
 * No actor-size or missile-height convention is inferred. Internal checkpoints
 * retain typed arrays; gameplay saves continue to own only presentation facts. */
export class BaronAttackSystem {
  private readonly emitters: EmitterState[];
  private particles: Particle[] = [];
  private rng: ParticlePreviewRng;
  private now = 0;
  private steps = 0;
  private born = 0;
  private readonly capacity: number;
  constructor(
    program: BaronAttackProgram,
    readonly role: BaronAttackRole,
    seed: number,
    options: BaronSystemOptions
  ) {
    if (
      program.format !== 2 ||
      program.sourcePinSha256 !==
        '4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a' ||
      program.profiles.length !== 21 ||
      !['missile', 'hit'].includes(role)
    )
      throw Error('Invalid Baron source program identity/closure');
    if (!Number.isSafeInteger(options.capacity) || options.capacity < 1 || options.capacity > 65535)
      throw RangeError('Invalid Baron particle capacity');
    this.capacity = options.capacity;
    this.rng = new ParticlePreviewRng(seed);
    const profiles = freeze(structuredClone(program.profiles.filter((p) => p.role === role)));
    if (profiles.length !== (role === 'missile' ? 9 : 12) || profiles.some((p, i) => p.index !== i))
      throw Error('Invalid Baron emitter order');
    this.emitters = profiles.map((profile) => {
      if (profile.flex && !options.birthFactors)
        throw Error('Baron bound-size birth policy must be explicit');
      const factors = profile.flex
        ? options.birthFactors!(profile)
        : { birthScale: 1, emitOffset: 1 };
      const prepared = new BaronPreparedEmitter(profile, program, factors);
      return {
        prepared,
        schedule: new SourceEmitterSchedule(prepared.schedule),
        chance: null,
        travelled: 0,
        spawnedAt: null,
        finishedAt: null,
        position: new Float32Array(3),
        frame: new Float32Array(I),
      };
    });
  }
  get time() {
    return this.now;
  }
  get count() {
    return this.particles.length;
  }
  profile(index: number): Readonly<BaronAttackProfile> {
    const emitter = this.emitters[index];
    if (!emitter) throw RangeError('Invalid Baron emitter index');
    return emitter.prepared.profile;
  }
  step(input: BaronSystemStep) {
    const point = (v: ArrayLike<number>, width: number) =>
      v.length === width &&
      Array.from(v).every((value) => Number.isFinite(value) && Number.isFinite(Math.fround(value)));
    if (
      !Number.isFinite(input.dt) ||
      input.dt <= 0 ||
      !point(input.origin, 3) ||
      !point(input.moved, 3) ||
      !point(input.orientation, 9) ||
      typeof input.stopped !== 'boolean'
    )
      throw RangeError('Invalid Baron system step');
    const now = this.now + input.dt;
    if (!Number.isFinite(now) || now <= this.now)
      throw RangeError('Invalid Baron system clock advance');
    const orientation = Float32Array.from(input.orientation),
      draw = () => this.rng.unitFloat();
    for (const emitter of this.emitters) {
      const p = emitter.prepared,
        phase = sourceEmissionWindow(p.schedule.window, now).phase;
      emitter.position = new Float32Array(p.position.sample(phase));
      emitter.frame = baronFlag(p.profile.settings.isLocalOrientation, true)
        ? new Float32Array(orientation)
        : new Float32Array(I);
    }
    for (const [index, emitter] of this.emitters.entries()) {
      const p = emitter.prepared,
        planning = emitter.schedule.plan(
          {
            now,
            dt: input.dt,
            stopped: input.stopped,
            maxAccepted: this.capacity - this.particles.length,
          },
          draw
        );
      const plans = planning.births;
      if (emitter.schedule.snapshot().lastSpawn !== now) continue;
      const local = turn(emitter.frame, emitter.position),
        spawnedAt = Array.from(local, (v, axis) => input.origin[axis] + 0 + v);
      if (emitter.spawnedAt)
        emitter.travelled += Math.hypot(
          ...spawnedAt.map((v, axis) => v - emitter.spawnedAt![axis])
        );
      emitter.spawnedAt = spawnedAt;
      if (baronFlag(p.profile.settings.ParticlesShareRandomValue) && emitter.chance === null)
        emitter.chance = draw();
      for (const plan of plans) {
        const shared = emitter.chance ?? draw(),
          birth = p.birth.sample(plan.phase, draw);
        for (let axis = 0; axis < 3; axis++) birth.scale[axis] *= p.factors.birthScale;
        const shape = p.shape(plan.phase, draw),
          surface = p.surface?.(draw) ?? null;
        const placed = sourceBirthPlacement({
          base: emitter.position,
          offset: shape.offset,
          turn: shape.turn,
          turned: shape.turned,
          velocity: birth.velocity,
          acceleration: ZERO,
          surface,
          surfaceScale: p.profile.emissionMesh?.scale ?? 1,
          useNormal: p.profile.emissionMesh?.useNormal ?? false,
          offsetScale: p.factors.emitOffset,
        });
        const uv = p.uv.birth(plan.phase, shared),
          multUv = p.multUv?.birth(plan.phase, shared) ?? null;
        const tiled = p.tiling?.drawChannels(plan.phase, draw) ?? new Float32Array(3);
        this.particles.push({
          emitter: index,
          serial: this.born++ >>> 0,
          ordinal: plan.ordinal,
          birthTime: Math.fround(plan.time),
          lifetime: birth.lifetime,
          lingerFrom: null,
          fresh: true,
          roll: Math.fround(shared),
          position: placed.position,
          velocity: placed.velocity,
          acceleration: placed.acceleration,
          birthRotation: birth.rotation,
          angularVelocity: birth.angularVelocity,
          birthScale: birth.scale,
          birthDrag: birth.drag,
          birthColor: birth.color,
          anchor: Float32Array.from(
            input.origin,
            (v, axis) => v - input.moved[axis] * (1 - plan.share) + 0
          ),
          frame: new Float32Array(emitter.frame),
          placed: new Float32Array(3),
          bound: new Float32Array(3),
          rotation: new Float32Array(3),
          worldPosition: new Float32Array(3),
          travel: new Float32Array(3),
          standingFrame: new Float32Array(9),
          uv,
          multUv,
          tiling: tiled.slice(0, 2),
          odometer: Math.fround(emitter.travelled),
        });
      }
      // Native preview draws before asking the pool for the next slot.
      if (planning.planned > plans.length && emitter.chance === null) draw();
    }
    for (const [index, emitter] of this.emitters.entries()) {
      const own = this.particles.filter((p) => p.emitter === index),
        state = emitter.schedule.snapshot();
      const settled = sourceLifetimeSettlement(
        emitter.prepared.lifetime,
        {
          age: now,
          lastSpawn: state.lastSpawn,
          emitted: state.emitted,
          finishedAt: emitter.finishedAt,
        },
        own,
        { now, stopped: input.stopped }
      );
      emitter.finishedAt = settled.state.finishedAt;
      own.forEach((particle, i) => {
        particle.lifetime = settled.particles[i].lifetime;
        particle.lingerFrom = settled.particles[i].lingerFrom;
      });
    }
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index],
        age = now - particle.birthTime;
      if (age >= particle.lifetime) {
        this.particles[index] = this.particles.at(-1)!;
        this.particles.pop();
        continue;
      }
      const emitter = this.emitters[particle.emitter],
        p = emitter.prepared;
      const motion = sourceSteppedMotion({
        position: particle.position,
        velocity: particle.velocity,
        birthAcceleration: particle.acceleration,
        acceleration: ZERO,
        carriedVelocity: ZERO,
        birthDrag: particle.birthDrag,
        drag: ZERO,
        dt: input.dt,
        fresh: particle.fresh,
      });
      particle.position = motion.position;
      particle.velocity = motion.velocity;
      particle.rotation = p.spin.sample({
        birthRotation: particle.birthRotation,
        angularVelocity: particle.angularVelocity,
        angularAcceleration: ZERO,
        age,
        life: particle.lifetime,
        lingering: particle.lingerFrom !== null,
      });
      const frame = p.frame.sample({
        position: particle.position,
        previousPlaced: particle.placed,
        bound: particle.bound,
        anchor: particle.anchor,
        birthFrame: particle.frame,
        currentYaw: orientation,
        emitterPosition: emitter.position,
        worldBasis: I,
        worldOffset: [0, 0, 0],
        worldHud: false,
        orbit: null,
        moved: input.moved,
        dt: input.dt,
        fresh: particle.fresh,
        age,
        life: particle.lifetime,
      });
      particle.placed = frame.placed;
      particle.bound = frame.bound;
      particle.worldPosition = frame.position;
      particle.travel = frame.travel;
      particle.standingFrame = frame.standingFrame;
      particle.fresh = false;
    }
    this.now = now;
    this.steps++;
  }
  packets() {
    return this.particles.map((p) => {
      const prepared = this.emitters[p.emitter].prepared,
        age = this.now - p.birthTime,
        phase = p.lifetime > 0 ? Math.min(Math.max(age / p.lifetime, 0), 1) : 1;
      const appearance = prepared.appearance.sample({
        birthScale: p.birthScale,
        birthColor: p.birthColor,
        age,
        life: p.lifetime,
        instanceScale: 1,
      });
      return {
        emitter: p.emitter,
        serial: p.serial,
        ordinal: p.ordinal,
        birthTime: p.birthTime,
        lifetime: p.lifetime,
        age,
        phase,
        roll: p.roll,
        position: new Float32Array(p.worldPosition),
        rotation: new Float32Array(p.rotation),
        standingFrame: new Float32Array(p.standingFrame),
        travel: new Float32Array(p.travel),
        scale: appearance.scale,
        color: appearance.color,
        uv: prepared.uv.sample(
          p.uv,
          age,
          p.lifetime,
          this.now,
          prepared.profile.geometry.kind !== 'mesh'
        ),
        multUv: p.multUv
          ? prepared.multUv!.sample(
              p.multUv,
              age,
              p.lifetime,
              this.now,
              prepared.profile.geometry.kind !== 'mesh'
            )
          : null,
        erosion: prepared.erosion ? Math.fround(prepared.erosion.sample(phase)[0]) : 1,
        erosionMixer: prepared.erosionMixer
          ? new Float32Array(prepared.erosionMixer.sample(0))
          : null,
        tiling: new Float32Array(p.tiling),
        odometer: p.odometer,
      };
    });
  }
  checkpoint(): BaronSystemCheckpoint {
    return structuredClone({
      version: 1 as const,
      role: this.role,
      now: this.now,
      steps: this.steps,
      born: this.born,
      rng: this.rng.snapshot(),
      emitters: this.emitters.map((e) => ({
        schedule: e.schedule.snapshot(),
        chance: e.chance,
        travelled: e.travelled,
        spawnedAt: e.spawnedAt,
        finishedAt: e.finishedAt,
      })),
      particles: this.particles,
    });
  }
  restore(checkpoint: BaronSystemCheckpoint) {
    const c = structuredClone(checkpoint);
    if (
      c.version !== 1 ||
      c.role !== this.role ||
      !Number.isFinite(c.now) ||
      c.now < 0 ||
      !Number.isSafeInteger(c.steps) ||
      c.steps < 0 ||
      !Number.isSafeInteger(c.born) ||
      c.born < c.particles.length ||
      c.emitters.length !== this.emitters.length ||
      c.particles.length > this.capacity
    )
      throw Error('Invalid Baron system checkpoint identity/extent');
    const rng = ParticlePreviewRng.fromState(c.rng),
      schedules = c.emitters.map((e, i) => {
        if (
          e.schedule.now !== c.now ||
          (e.chance !== null && (!Number.isFinite(e.chance) || e.chance < 0 || e.chance >= 1)) ||
          !Number.isFinite(e.travelled) ||
          e.travelled < 0 ||
          (e.spawnedAt !== null &&
            (e.spawnedAt.length !== 3 || !e.spawnedAt.every(Number.isFinite))) ||
          (e.finishedAt !== null &&
            (!Number.isFinite(e.finishedAt) || e.finishedAt < 0 || e.finishedAt > c.now))
        )
          throw Error('Invalid Baron emitter checkpoint');
        return new SourceEmitterSchedule(this.emitters[i].prepared.schedule, e.schedule);
      });
    const widths = {
      position: 3,
      velocity: 3,
      acceleration: 3,
      birthRotation: 3,
      angularVelocity: 3,
      birthScale: 3,
      birthDrag: 3,
      birthColor: 4,
      anchor: 3,
      frame: 9,
      placed: 3,
      bound: 3,
      rotation: 3,
      worldPosition: 3,
      travel: 3,
      standingFrame: 9,
      tiling: 2,
    };
    for (const particle of c.particles) {
      if (
        !particle.uv ||
        (this.emitters[particle.emitter]?.prepared.multUv !== null) !== (particle.multUv !== null)
      )
        throw Error('Invalid Baron UV checkpoint ownership');
      if (
        !Number.isSafeInteger(particle.emitter) ||
        !this.emitters[particle.emitter] ||
        !Number.isInteger(particle.serial) ||
        particle.serial < 0 ||
        particle.serial > 0xffffffff ||
        !Number.isInteger(particle.ordinal) ||
        particle.ordinal < 0 ||
        particle.ordinal > 65535 ||
        !Number.isFinite(particle.birthTime) ||
        particle.birthTime < 0 ||
        particle.birthTime > Math.fround(c.now) ||
        !(Number.isFinite(particle.lifetime) || particle.lifetime === Infinity) ||
        particle.lifetime < 0 ||
        typeof particle.fresh !== 'boolean' ||
        !Number.isFinite(particle.roll) ||
        particle.roll < 0 ||
        particle.roll >= 1 ||
        !Number.isFinite(particle.odometer) ||
        particle.odometer < 0 ||
        (particle.lingerFrom !== null &&
          (!Number.isFinite(particle.lingerFrom) ||
            particle.lingerFrom < 0 ||
            particle.lingerFrom > Math.fround(c.now)))
      )
        throw Error('Invalid Baron particle checkpoint');
      for (const [key, width] of Object.entries(widths)) {
        const value = particle[key as keyof typeof widths];
        if (
          !(value instanceof Float32Array) ||
          value.length !== width ||
          !value.every(Number.isFinite)
        )
          throw Error('Invalid Baron particle checkpoint vector');
      }
      for (const uv of [particle.uv, particle.multUv])
        if (
          uv &&
          (!(uv.offset instanceof Float32Array) ||
            uv.offset.length !== 2 ||
            !(uv.scroll instanceof Float32Array) ||
            uv.scroll.length !== 2 ||
            ![...uv.offset, ...uv.scroll, uv.rotation, uv.phase, uv.rate].every(Number.isFinite))
        )
          throw Error('Invalid Baron UV checkpoint');
    }
    c.emitters.forEach((e, i) => {
      Object.assign(this.emitters[i], e, {
        schedule: schedules[i],
        position: new Float32Array(3),
        frame: new Float32Array(I),
      });
    });
    this.now = c.now;
    this.steps = c.steps;
    this.born = c.born;
    this.rng = rng;
    this.particles = c.particles;
  }
}
