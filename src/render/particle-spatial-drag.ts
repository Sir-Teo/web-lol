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
    previous = new Float32Array(3);
  for (let step = 0; step < whole + (fraction > 0 ? 1 : 0); step++) {
    previous.set(position);
    for (let axis = 0; axis < 3; axis++)
      travel[axis] = (travel[axis] + acceleration[axis] / 60) * Math.max(0, 1 - drag[axis] / 60);
    if (field) {
      const squared = field.position.reduce(
        (sum, x, axis) => sum + (x - origin[axis] - position[axis]) ** 2,
        0
      );
      if (squared <= field.radius ** 2)
        for (let axis = 0; axis < 3; axis++) travel[axis] *= Math.max(0, 1 - field.strength / 60);
    }
    for (let axis = 0; axis < 3; axis++) position[axis] += travel[axis] / 60;
  }
  return {
    position: [...position].map((x, axis) =>
      fraction > 0 ? previous[axis] + (x - previous[axis]) * fraction : x
    ),
    travel: [...travel],
  };
}
