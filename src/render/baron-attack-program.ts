import type { SourceValueDefinition } from './source-value';
import type { SourceSpawnShape } from './source-spawn-shape';
import type { SourceLegacyShapeDefinition } from './source-legacy-spawn-shape';
export type BaronAttackRole = 'missile' | 'hit';
export type BaronAttackGeometry =
  | { kind: 'billboard' | 'quad'; declared: boolean }
  | { kind: 'mesh'; declared: boolean; asset: string }
  | {
      kind: 'arbitrary-trail' | 'camera-trail';
      declared: boolean;
      mode: number;
      smoothing: 0;
      cutoff: number;
      tiling: SourceValueDefinition;
    };
export type BaronAttackShape =
  | (SourceSpawnShape & { declared?: boolean; sourceType?: string })
  | (SourceLegacyShapeDefinition & { kind: 'legacy'; sourceType: string });
export interface BaronAttackSettings {
  emitterName: string;
  lifetime?: number;
  particleLinger?: number;
  emitterLinger?: number;
  timeBeforeFirstEmission?: number;
  period?: number;
  timeActiveDuringPeriod?: number;
  isSingleParticle?: boolean | number;
  isUniformScale?: boolean | number;
  isLocalOrientation?: boolean | number;
  particleIsLocalOrientation?: boolean | number;
  isRotationEnabled?: boolean | number;
  ParticlesShareRandomValue?: boolean | number;
  blendMode?: number;
  pass?: number;
  alphaRef?: number;
  disableBackfaceCull?: boolean | number;
  miscRenderFlags?: number;
  numFrames?: number;
  texDiv?: number[];
  isRandomStartFrame?: boolean | number;
  startFrame?: number;
  frameRate?: number;
  isGroundLayer?: boolean | number;
  isDirectionOriented?: boolean | number;
  directionVelocityScale?: number;
  directionVelocityMinScale?: number;
  depthBiasFactors?: number[];
  importance?: number;
}
export interface BaronAttackProfile {
  role: BaronAttackRole;
  index: number;
  name: string;
  geometry: BaronAttackGeometry;
  shape: BaronAttackShape;
  curves: Partial<
    Record<
      | 'rate'
      | 'particleLifetime'
      | 'bindWeight'
      | 'uvRotation'
      | 'birthVelocity'
      | 'birthDrag'
      | 'worldAcceleration'
      | 'birthRotation0'
      | 'birthRotationalVelocity0'
      | 'birthScale0'
      | 'scale0'
      | 'EmitterPosition'
      | 'birthColor'
      | 'Color'
      | 'uvScale'
      | 'birthUVOffset'
      | 'birthUvScrollRate',
      SourceValueDefinition
    >
  >;
  material: {
    texture: string;
    multiplier?: { texture: string; scroll: SourceValueDefinition; offset: SourceValueDefinition };
    erosion?: { texture: string; mixer: SourceValueDefinition; drive: SourceValueDefinition };
    palette?: { texture: string; count: number };
  };
  emissionMesh: { asset: string; scale: number; useNormal: boolean } | null;
  flex: {
    __type: string;
    scaleBirthScaleByBoundObjectSize?: number;
    scaleEmitOffsetByBoundObjectSize?: number;
  } | null;
  audio: { __type: string } | null;
  settings: BaronAttackSettings;
  explicitFields: string[];
}
export interface BaronAttackProgram {
  format: 2;
  sourcePinSha256: string;
  profiles: BaronAttackProfile[];
  emissionSurfaces: Record<
    string,
    { positions: number[]; indices: number[]; sourceSha256: string }
  >;
}
export function baronConstant(constant: readonly number[]): SourceValueDefinition {
  return {
    constant: [...constant],
    times: [0],
    values: [[...constant]],
    authoredKeyCount: 0,
    probabilities: [],
  };
}
export const baronFlag = (value: boolean | number | undefined, fallback = false) =>
  value === undefined ? fallback : value === true || value === 1;
