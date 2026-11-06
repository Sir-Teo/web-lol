import { SourceValue } from './source-value';
import { SourceBirthValues } from './source-birth-values';
import { SourceLegacySpawnShape } from './source-legacy-spawn-shape';
import { sourceSpawnShape } from './source-spawn-shape';
import { SourceParticleAppearance } from './source-particle-appearance';
import { SourceParticleSpin } from './source-particle-spin';
import { SourceParticleFrame } from './source-particle-frame';
import { SourceUvLayer, type SourceUvLayerDefinition } from './source-uv-layer';
import type { SourceEmitterScheduleDefinition } from './source-emitter-schedule';
import type { SourceLifetimePolicy } from './source-lifetime-settlement';
import { staticEmissionSurface } from './static-emission-surface';
import {
  baronConstant,
  baronFlag,
  type BaronAttackProfile,
  type BaronAttackProgram,
} from './baron-attack-program';
export interface BaronBirthFactors {
  birthScale: number;
  emitOffset: number;
}
export class BaronPreparedEmitter {
  readonly birth: SourceBirthValues;
  readonly position: SourceValue;
  readonly appearance: SourceParticleAppearance;
  readonly spin: SourceParticleSpin;
  readonly frame: SourceParticleFrame;
  readonly uv: SourceUvLayer;
  readonly multUv: SourceUvLayer | null;
  readonly schedule: SourceEmitterScheduleDefinition;
  readonly lifetime: SourceLifetimePolicy;
  readonly tiling: SourceValue | null;
  readonly erosion: SourceValue | null;
  readonly erosionMixer: SourceValue | null;
  readonly surface: ReturnType<typeof staticEmissionSurface> | null;
  readonly factors: BaronBirthFactors;
  private readonly legacy: SourceLegacySpawnShape | null;
  constructor(
    readonly profile: BaronAttackProfile,
    program: BaronAttackProgram,
    factors: BaronBirthFactors
  ) {
    if (![factors.birthScale, factors.emitOffset].every(Number.isFinite))
      throw RangeError('Invalid explicit Baron birth factors');
    this.factors = { ...factors };
    const p = profile,
      c = p.curves,
      s = p.settings,
      v = (key: keyof typeof c, fallback: number[]) => c[key] ?? baronConstant(fallback);
    if (!c.rate || !c.particleLifetime) throw Error('Baron profile lacks required rate/lifetime');
    this.birth = new SourceBirthValues({
      lifetime: c.particleLifetime,
      velocity: v('birthVelocity', [0, 0, 0]),
      rotation: v('birthRotation0', [0, 0, 0]),
      angularVelocity: v('birthRotationalVelocity0', [0, 0, 0]),
      scale: v('birthScale0', [1, 1, 1]),
      drag: v('birthDrag', [0, 0, 0]),
      color: v('birthColor', [1, 1, 1, 1]),
    });
    this.position = new SourceValue(v('EmitterPosition', [0, 0, 0]));
    this.appearance = new SourceParticleAppearance({
      scale: v('scale0', [1, 1, 1]),
      color: v('Color', [1, 1, 1, 1]),
      uniform: baronFlag(s.isUniformScale),
      geometry: p.geometry.kind,
      modulation: [1, 1, 1, 1],
    });
    this.spin = new SourceParticleSpin({
      enabled: baronFlag(s.isRotationEnabled),
      rotation: baronConstant([0, 0, 0]),
    });
    this.frame = new SourceParticleFrame({
      emitterSpace: false,
      particleLocalOrientation: baronFlag(s.particleIsLocalOrientation),
      bindWeight: v('bindWeight', [0]),
      worldAcceleration: v('worldAcceleration', [0, 0, 0]),
    });
    const window = {
      lifetime: s.lifetime ?? null,
      particleLifetimeMaximum: c.particleLifetime.authoredKeyCount
        ? Math.max(...c.particleLifetime.values.map((v) => v[0]))
        : c.particleLifetime.constant[0],
      simple: false,
      singleParticle: baronFlag(s.isSingleParticle),
      overridesMaterials: false,
      delay: s.timeBeforeFirstEmission ?? 0,
      emitterLinger: s.emitterLinger ?? 0,
      period:
        s.period === undefined && s.timeActiveDuringPeriod === undefined
          ? null
          : { length: s.period ?? null, active: s.timeActiveDuringPeriod ?? null },
    };
    this.schedule = {
      rate: c.rate,
      window,
      variableStart: false,
      maxPerFrame: 0,
      segmentLimit: null,
      rateScale: 1,
    };
    this.lifetime = { window, kind: 0, particleLinger: s.particleLinger ?? 0 };
    const base: SourceUvLayerDefinition = {
      scale: v('uvScale', [1, 1]),
      rotation: v('uvRotation', [0]),
      birthOffset: v('birthUVOffset', [0, 0]),
      birthScrollRate: v('birthUvScrollRate', [0, 0]),
      birthRotateRate: baronConstant([0]),
      birthFrameRate: baronConstant([1]),
      scrollRate: baronConstant([0, 0]),
      rotateRate: baronConstant([0]),
      book: {
        divisions: s.texDiv ?? [1, 1],
        frames: s.numFrames ?? 1,
        start: s.startFrame ?? 0,
        rate: s.frameRate ?? 0,
        randomStart: baronFlag(s.isRandomStartFrame),
      },
      center: [0.5, 0.5],
      emitterScrollRate: [0, 0],
      flipU: false,
      flipV: false,
      scrollClamp: false,
      addressMode: 0,
    };
    this.uv = new SourceUvLayer(base);
    this.multUv = p.material.multiplier
      ? new SourceUvLayer({
          ...base,
          scale: baronConstant([1, 1]),
          rotation: baronConstant([0]),
          birthOffset: p.material.multiplier.offset,
          birthScrollRate: p.material.multiplier.scroll,
          book: { ...base.book, divisions: [1, 1] },
        })
      : null;
    this.tiling = 'tiling' in p.geometry ? new SourceValue(p.geometry.tiling) : null;
    this.erosion = p.material.erosion ? new SourceValue(p.material.erosion.drive) : null;
    this.erosionMixer = p.material.erosion ? new SourceValue(p.material.erosion.mixer) : null;
    this.legacy = p.shape.kind === 'legacy' ? new SourceLegacySpawnShape(p.shape) : null;
    if (p.shape.kind !== 'legacy') sourceSpawnShape(p.shape, () => 0.5);
    const surface = p.emissionMesh ? program.emissionSurfaces[p.emissionMesh.asset] : null;
    if (p.emissionMesh && !surface) throw Error('Baron emission surface is missing');
    this.surface = surface ? staticEmissionSurface(surface.positions, surface.indices) : null;
  }
  shape(phase: number, draw: () => number) {
    return this.legacy
      ? this.legacy.sample(phase, draw)
      : sourceSpawnShape(
          this.profile.shape as Exclude<BaronAttackProfile['shape'], { kind: 'legacy' }>,
          draw
        );
  }
}
