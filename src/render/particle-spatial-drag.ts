export interface SpatialDragField {
  position: readonly number[];
  radius: number;
  strength: number;
}
/** Explicit local 60 Hz replay: acceleration, birth damping, spatial damping,
 * then movement. The spatial field stays at the captured birth root. Its
 * radius is a hard boundary; the pinned 65a7 reader applies no distance falloff.
 * Float32 endpoints and fractional position interpolation support exact seeks.
 * This is a reconstruction policy, not native cadence/transform certification. */
export function spatialDragTravel(
  velocity: readonly number[],
  acceleration: readonly number[],
  drag: readonly number[],
  origin: readonly number[],
  age: number,
  field: SpatialDragField | null
) {
  if (
    [velocity, acceleration, drag, origin].some(
      (v) => v.length !== 3 || v.some((x) => !Number.isFinite(x))
    ) ||
    !Number.isFinite(age) ||
    age < 0 ||
    drag.some((x) => x < 0) ||
    (field &&
      (field.position.length !== 3 ||
        field.position.some((x) => !Number.isFinite(x)) ||
        !Number.isFinite(field.radius) ||
        field.radius < 0 ||
        !Number.isFinite(field.strength) ||
        field.strength < 0))
  )
    throw RangeError('Invalid spatial drag particle inputs');
  const position = new Float32Array(3),
    travel = new Float32Array(velocity),
    ticks = age * 60,
    whole = Math.floor(ticks),
    fraction = ticks - whole,
    previous = fraction > 0 ? new Float32Array(3) : null,
    damping = drag.map((x) => Math.max(0, 1 - x / 60)),
    fieldDamping = field ? Math.max(0, 1 - field.strength / 60) : 1,
    fieldRadiusSquared = field ? field.radius ** 2 : 0;
  for (let step = 0; step < whole + (fraction > 0 ? 1 : 0); step++) {
    // Only the fractional endpoint needs its preceding position. Keep every
    // Float32 force/movement write and its evaluation order unchanged.
    if (previous && step === whole) previous.set(position);
    for (let axis = 0; axis < 3; axis++)
      travel[axis] = (travel[axis] + acceleration[axis] / 60) * damping[axis];
    if (field) {
      const squared = field.position.reduce(
        (sum, x, axis) => sum + (x - origin[axis] - position[axis]) ** 2,
        0
      );
      if (squared <= fieldRadiusSquared)
        for (let axis = 0; axis < 3; axis++) travel[axis] *= fieldDamping;
    }
    for (let axis = 0; axis < 3; axis++) position[axis] += travel[axis] / 60;
  }
  return {
    position: [...position].map((x, axis) =>
      previous ? previous[axis] + (x - previous[axis]) * fraction : x
    ),
    travel: [...travel],
  };
}
