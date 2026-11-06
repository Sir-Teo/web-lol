import { SourceValue, type SourceValueDefinition } from './source-value';
import { SourceIntegratedValue } from './source-integrated-value';
export interface SourceParticleSpinDefinition {
  enabled: boolean;
  rotation: SourceValueDefinition;
  lingerRotation?: SourceValueDefinition;
}
export interface SourceParticleSpinInput {
  birthRotation: ArrayLike<number>;
  angularVelocity: ArrayLike<number>;
  angularAcceleration: ArrayLike<number>;
  age: number;
  life: number;
  lingering: boolean;
}
/** Complex-particle degrees, before the source drawing basis is built. */
export class SourceParticleSpin {
  private readonly rotation: SourceIntegratedValue;
  private readonly linger: SourceValue | null;
  private readonly enabled: boolean;
  constructor(definition: SourceParticleSpinDefinition) {
    if (
      typeof definition.enabled !== 'boolean' ||
      definition.rotation.constant.length !== 3 ||
      (definition.lingerRotation && definition.lingerRotation.constant.length !== 3)
    )
      throw RangeError('Invalid source spin definition');
    this.enabled = definition.enabled;
    this.rotation = new SourceIntegratedValue(definition.rotation);
    // The explicit linger replacement is read directly by the external turn path.
    this.linger = definition.lingerRotation
      ? new SourceValue({ ...definition.lingerRotation, sourceType: undefined })
      : null;
  }
  // Float32 birth times can put a fresh particle slightly ahead of the double clock.
  sample(input: SourceParticleSpinInput): Float32Array {
    const vector = (v: ArrayLike<number>) => {
      if (
        v.length !== 3 ||
        !Array.from(v).every((x) => Number.isFinite(x) && Number.isFinite(Math.fround(x)))
      )
        throw RangeError('Invalid source spin vector');
      return Float32Array.from(v);
    };
    const birth = vector(input.birthRotation),
      rate = vector(input.angularVelocity),
      acceleration = vector(input.angularAcceleration);
    if (
      !Number.isFinite(input.age) ||
      !(Number.isFinite(input.life) || input.life === Infinity) ||
      input.life < 0 ||
      typeof input.lingering !== 'boolean'
    )
      throw RangeError('Invalid source spin clock');
    const age = input.age,
      life = Math.fround(input.life),
      result = new Float32Array(3);
    for (let axis = 0; axis < 3; axis++)
      result[axis] = birth[axis] + age * (rate[axis] + 0.5 * age * acceleration[axis]);
    if (!this.enabled || !Number.isFinite(life)) return result;
    const phase = life > 0 ? Math.min(Math.max(age / life, 0), 1) : 1;
    const integrated =
      input.lingering && this.linger
        ? new Float32Array(this.linger.sample(phase))
        : this.rotation.sample(phase, 1);
    for (let axis = 0; axis < 3; axis++) result[axis] += integrated[axis] * 60 * life;
    return result;
  }
}
/** Native source basis for degrees: Ry * Rx * Rz, row-major with local axes
 * in its columns. Returned float32 storage is independent of caller buffers. */
export function sourceParticleBasis(degrees: ArrayLike<number>, roll = 0): Float32Array {
  if (
    degrees.length !== 3 ||
    !Array.from(degrees).every((x) => Number.isFinite(x) && Number.isFinite(Math.fround(x))) ||
    !Number.isFinite(roll)
  )
    throw RangeError('Invalid source particle angles');
  const d = Float32Array.from(degrees),
    factor = Math.PI / 180;
  const cx = Math.cos(d[0] * factor),
    sx = Math.sin(d[0] * factor),
    cy = Math.cos(d[1] * factor),
    sy = Math.sin(d[1] * factor);
  const cz = Math.cos((d[2] + roll) * factor),
    sz = Math.sin((d[2] + roll) * factor);
  return new Float32Array([
    cy * cz + sy * sx * sz,
    -cy * sz + sy * sx * cz,
    sy * cx,
    cx * sz,
    cx * cz,
    -sx,
    -sy * cz + cy * sx * sz,
    sy * sz + cy * sx * cz,
    cy * cx,
  ]);
}
