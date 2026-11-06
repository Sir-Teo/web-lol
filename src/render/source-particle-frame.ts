import { SourceValue, type SourceValueDefinition } from './source-value';
import { SourceIntegratedValue } from './source-integrated-value';
export interface SourceParticleFrameDefinition {
  emitterSpace: boolean;
  particleLocalOrientation: boolean;
  bindWeight: SourceValueDefinition;
  worldAcceleration: SourceValueDefinition;
}
export interface SourceParticleFrameInput {
  position: ArrayLike<number>;
  previousPlaced: ArrayLike<number>;
  bound: ArrayLike<number>;
  anchor: ArrayLike<number>;
  birthFrame: ArrayLike<number>;
  currentYaw: ArrayLike<number>;
  emitterPosition: ArrayLike<number>;
  worldBasis: ArrayLike<number>;
  worldOffset: ArrayLike<number>;
  worldHud: boolean;
  orbit: ArrayLike<number> | null;
  moved: ArrayLike<number>;
  dt: number;
  fresh: boolean;
  age: number;
  life: number;
}
/** Source-frame placement and travel binding, followed by draw placement.
 * Caller retains the original fresh flag until motion and frame stages finish.
 * All positions remain in source units; actor/scene calibration is separate. */
export class SourceParticleFrame {
  private readonly bind: SourceValue;
  private readonly acceleration: SourceIntegratedValue;
  private readonly emitterSpace: boolean;
  private readonly local: boolean;
  constructor(definition: SourceParticleFrameDefinition) {
    if (
      typeof definition.emitterSpace !== 'boolean' ||
      typeof definition.particleLocalOrientation !== 'boolean' ||
      definition.bindWeight.constant.length !== 1 ||
      definition.worldAcceleration.constant.length !== 3
    )
      throw RangeError('Invalid source particle frame definition');
    this.bind = new SourceValue(definition.bindWeight);
    this.acceleration = new SourceIntegratedValue(definition.worldAcceleration);
    this.emitterSpace = definition.emitterSpace;
    this.local = definition.particleLocalOrientation;
  }
  // Float32 birth times can put a fresh particle slightly ahead of the double clock.
  sample(input: SourceParticleFrameInput) {
    const vector = (v: ArrayLike<number>, width = 3, round = true) => {
      if (
        v.length !== width ||
        !Array.from(v).every(
          (x) => Number.isFinite(x) && (!round || Number.isFinite(Math.fround(x)))
        )
      )
        throw RangeError('Invalid source particle frame vector');
      return round ? Float32Array.from(v) : Float64Array.from(v);
    };
    const position = vector(input.position),
      previous = vector(input.previousPlaced),
      bound = vector(input.bound),
      anchor = vector(input.anchor);
    const birth = vector(input.birthFrame, 9),
      yaw = vector(input.currentYaw, 9),
      emitter = vector(input.emitterPosition);
    const world = vector(input.worldBasis, 9),
      offset = vector(input.worldOffset, 3, false),
      moved = vector(input.moved, 3, false);
    const orbit = input.orbit ? vector(input.orbit, 9) : null;
    if (
      !Number.isFinite(input.dt) ||
      input.dt < 0 ||
      !Number.isFinite(input.age) ||
      !(Number.isFinite(input.life) || input.life === Infinity) ||
      input.life < 0 ||
      ![input.fresh, input.worldHud].every((v) => typeof v === 'boolean')
    )
      throw RangeError('Invalid source particle frame clock');
    const turn = (matrix: ArrayLike<number>, value: Float32Array) => {
      const [x, y, z] = value;
      for (let axis = 0; axis < 3; axis++)
        value[axis] = matrix[axis * 3] * x + matrix[axis * 3 + 1] * y + matrix[axis * 3 + 2] * z;
    };
    const dt = input.fresh ? 0 : input.dt,
      placed = new Float32Array(3);
    for (let axis = 0; axis < 3; axis++)
      placed[axis] = position[axis] + (this.emitterSpace ? emitter[axis] : 0);
    if (this.local) turn(yaw, placed);
    if (orbit) turn(orbit, placed);
    if (!input.worldHud) {
      turn(world, placed);
      for (let axis = 0; axis < 3; axis++) placed[axis] += offset[axis];
    }
    const drift = new Float32Array(3);
    for (let axis = 0; axis < 3; axis++)
      drift[axis] = dt > 0 ? (placed[axis] - previous[axis]) / dt : 0;
    const travel = new Float32Array(drift);
    if (!this.local) turn(birth, travel);
    const life = Math.fround(input.life),
      phase = life > 0 ? Math.min(Math.max(input.age / life, 0), 1) : 1;
    const weight = dt > 0 ? Math.fround(this.bind.sample(phase)[0]) : 0;
    if (weight > 0)
      for (let axis = 0; axis < 3; axis++) {
        bound[axis] += weight * moved[axis];
        travel[axis] += (weight * moved[axis]) / dt;
      }
    const drawn = new Float32Array(placed);
    if (!this.local) turn(birth, drawn);
    for (let axis = 0; axis < 3; axis++) drawn[axis] += anchor[axis] + bound[axis];
    if (Number.isFinite(life)) {
      const acceleration = this.acceleration.sample(phase, 2);
      for (let axis = 0; axis < 3; axis++) drawn[axis] += acceleration[axis] * life * life;
    }
    return {
      placed,
      drift,
      bound: Float32Array.from(bound),
      travel,
      position: drawn,
      standingFrame: Float32Array.from(this.local ? yaw : birth),
    };
  }
}
