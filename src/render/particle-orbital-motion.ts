/** Pinned 65a7 reconstruction: preserve along-axis and transverse speed while
 * redirecting transverse motion tangentially. The small guards remain reader
 * defaults, not an attested native precision/cadence certificate. */
export function redirectOrbitalVelocity(
  velocity: Float32Array,
  point: ArrayLike<number>,
  axis: readonly number[]
): void {
  const along = velocity[0] * axis[0] + velocity[1] * axis[1] + velocity[2] * axis[2];
  const transverse = [
    velocity[0] - along * axis[0],
    velocity[1] - along * axis[1],
    velocity[2] - along * axis[2],
  ];
  const speed = Math.hypot(...transverse);
  if (speed <= 0.001) return;
  const distance = Math.hypot(point[0], point[1], point[2]);
  if (distance === 0) return;
  const direction = [point[0] / distance, point[1] / distance, point[2] / distance];
  if (
    Math.abs(1 - (axis[0] * direction[0] + axis[1] * direction[1] + axis[2] * direction[2])) <= 1e-4
  )
    return;
  const tangent = [
      direction[1] * axis[2] - direction[2] * axis[1],
      direction[2] * axis[0] - direction[0] * axis[2],
      direction[0] * axis[1] - direction[1] * axis[0],
    ],
    length = Math.hypot(...tangent);
  if (length === 0) return;
  let scale = speed / length;
  if (tangent.reduce((sum, value, index) => sum + value * transverse[index], 0) < 0) scale = -scale;
  for (let index = 0; index < 3; index++)
    velocity[index] = along * axis[index] + tangent[index] * scale;
}

/** Local 60 Hz seek replay. World-up acceleration and the world-up field commute
 * with the actor's Y heading; reject other axes rather than invent their frame.
 * Keep world acceleration separate for the surface adapter's world-axis offset.
 */
export function orbitalParticleTravel(
  velocity: readonly number[],
  acceleration: readonly number[],
  origin: readonly number[],
  age: number,
  axis: readonly number[]
) {
  if (
    [velocity, acceleration, origin, axis].some(
      (vector) => vector.length !== 3 || vector.some((value) => !Number.isFinite(value))
    ) ||
    axis.length !== 3 ||
    axis[0] !== 0 ||
    axis[1] !== 1 ||
    axis[2] !== 0 ||
    acceleration[0] !== 0 ||
    acceleration[2] !== 0 ||
    !Number.isFinite(age) ||
    age < 0
  )
    throw RangeError('Unsupported orbital particle frame/time');
  const localTravel = [...velocity],
    worldTravel = [0, 0, 0],
    localPosition = [0, 0, 0],
    worldPosition = [0, 0, 0],
    moving = new Float32Array(velocity),
    point = new Float32Array(origin);
  // An orbital field reaches the first particle update even at dt=0.
  redirectOrbitalVelocity(moving, point, axis);
  for (let index = 0; index < 3; index++) localTravel[index] = moving[index];
  const ticks = age * 60,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  for (let step = 1; step <= whole + (fraction > 0 ? 1 : 0); step++) {
    for (let index = 0; index < 3; index++) {
      worldTravel[index] += acceleration[index] / 60;
      moving[index] = localTravel[index] + worldTravel[index];
      point[index] = origin[index] + localPosition[index] + worldPosition[index];
    }
    redirectOrbitalVelocity(moving, point, axis);
    const portion = step <= whole ? 1 : fraction;
    for (let index = 0; index < 3; index++) {
      localTravel[index] = moving[index] - worldTravel[index];
      localPosition[index] += (localTravel[index] / 60) * portion;
      worldPosition[index] += (worldTravel[index] / 60) * portion;
    }
  }
  return {
    local: { position: localPosition, travel: localTravel },
    world: { position: worldPosition, travel: worldTravel },
  };
}
