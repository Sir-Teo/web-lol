import { SourceValue, type SourceValueDefinition } from './source-value';
export type SourceAppearanceGeometry =
  'billboard' | 'quad' | 'mesh' | 'arbitrary-trail' | 'camera-trail';
export interface SourceAppearanceDefinition {
  scale: SourceValueDefinition;
  color: SourceValueDefinition;
  uniform: boolean;
  geometry: SourceAppearanceGeometry;
  modulation: readonly number[];
}
export interface SourceAppearanceInput {
  birthScale: ArrayLike<number>;
  birthColor: ArrayLike<number>;
  age: number;
  life: number;
  instanceScale: number;
}
/** Current strict Baron appearance has no live probability/flicker tables or
 * linger replacement curves. HDR color and native-unit scale are not clamped. */
export class SourceParticleAppearance {
  private readonly scale: SourceValue;
  private readonly color: SourceValue;
  private readonly modulation: Float64Array;
  private readonly uniform: boolean;
  constructor(definition: SourceAppearanceDefinition) {
    if (
      definition.scale.constant.length !== 3 ||
      definition.color.constant.length !== 4 ||
      definition.modulation.length !== 4 ||
      !definition.modulation.every(Number.isFinite) ||
      typeof definition.uniform !== 'boolean' ||
      !['billboard', 'quad', 'mesh', 'arbitrary-trail', 'camera-trail'].includes(
        definition.geometry
      )
    )
      throw RangeError('Invalid source appearance definition');
    if (definition.scale.probabilities.length || definition.color.probabilities.length)
      throw RangeError('Live source tables require the flicker adapter');
    this.scale = new SourceValue(definition.scale);
    this.color = new SourceValue(definition.color);
    this.modulation = Float64Array.from(definition.modulation);
    this.uniform =
      definition.uniform && ['billboard', 'quad', 'mesh'].includes(definition.geometry);
  }
  // Float32 birth times can put a fresh particle slightly ahead of the double clock.
  sample(input: SourceAppearanceInput) {
    const vector = (v: ArrayLike<number>, width: number) => {
      if (
        v.length !== width ||
        !Array.from(v).every((x) => Number.isFinite(x) && Number.isFinite(Math.fround(x)))
      )
        throw RangeError('Invalid source appearance birth value');
      return Float32Array.from(v);
    };
    const birthScale = vector(input.birthScale, 3),
      birthColor = vector(input.birthColor, 4);
    if (
      !Number.isFinite(input.age) ||
      !(Number.isFinite(input.life) || input.life === Infinity) ||
      input.life < 0 ||
      !Number.isFinite(input.instanceScale)
    )
      throw RangeError('Invalid source appearance clock/scale');
    const life = Math.fround(input.life),
      phase = life > 0 ? Math.min(Math.max(input.age / life, 0), 1) : 1;
    const scale = new Float32Array(this.scale.sample(phase)),
      color = new Float32Array(this.color.sample(phase));
    for (let axis = 0; axis < 3; axis++) scale[axis] *= birthScale[axis] * input.instanceScale;
    if (this.uniform) scale.fill(scale[0], 1, 3);
    for (let channel = 0; channel < 4; channel++)
      color[channel] *= birthColor[channel] * this.modulation[channel];
    return { scale, color };
  }
}
