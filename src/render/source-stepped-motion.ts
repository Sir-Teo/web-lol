export interface SourceSteppedMotionInput {
  position: ArrayLike<number>;
  velocity: ArrayLike<number>;
  birthAcceleration: ArrayLike<number>;
  acceleration: ArrayLike<number>;
  carriedVelocity: ArrayLike<number>;
  birthDrag: ArrayLike<number>;
  drag: ArrayLike<number>;
  dt: number;
  fresh: boolean;
}
/** Field-free local-frame stepped motion. Caller samples live values, retires
 * expired particles and later applies spin/placement/carry. A fresh birth uses
 * zero delta on its first update, not its fractional age within that step. */
export function sourceSteppedMotion(input: SourceSteppedMotionInput) {
  const vector = (v: ArrayLike<number>) => {
    if (
      v.length !== 3 ||
      !Array.from(v).every((x) => Number.isFinite(x) && Number.isFinite(Math.fround(x)))
    )
      throw RangeError('Invalid source motion vector');
    return Float32Array.from(v);
  };
  const position = vector(input.position),
    velocity = vector(input.velocity);
  const birthAcceleration = vector(input.birthAcceleration),
    acceleration = vector(input.acceleration);
  const carried = vector(input.carriedVelocity),
    birthDrag = vector(input.birthDrag),
    drag = vector(input.drag);
  if (!Number.isFinite(input.dt) || input.dt < 0 || typeof input.fresh !== 'boolean')
    throw RangeError('Invalid source motion step');
  const dt = input.fresh ? 0 : input.dt,
    moving = new Float32Array(3);
  for (let axis = 0; axis < 3; axis++) {
    velocity[axis] = velocity[axis] + (birthAcceleration[axis] + acceleration[axis]) * dt;
    moving[axis] = velocity[axis] + carried[axis];
    drag[axis] += birthDrag[axis];
  }
  if (drag[0] !== 0 || drag[1] !== 0 || drag[2] !== 0)
    for (let axis = 0; axis < 3; axis++) {
      const before = moving[axis];
      let change = -drag[axis] * before * dt;
      if ((before + change) * before < 0) change = -before;
      moving[axis] += change;
      velocity[axis] += change;
    }
  for (let axis = 0; axis < 3; axis++) position[axis] += moving[axis] * dt;
  return { position, velocity, moving, fresh: false as const };
}
