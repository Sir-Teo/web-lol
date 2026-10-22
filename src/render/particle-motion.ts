import { TICK_RATE } from '../content/rules';

/** Local fixed-grid semi-implicit acceleration/drag with final-step interpolation.
 * Reconstructing from age supports random seeks; this is not native cadence proof.
 */
export function particleTravel(
  velocity: readonly number[],
  acceleration: readonly number[],
  drag: readonly number[],
  age: number
) {
  const ticks = age * TICK_RATE,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  const position = [0, 0, 0],
    travel = [...velocity];
  if (velocity.every((v) => v === 0) && acceleration.every((v) => v === 0))
    return { position, travel };
  for (let step = 1; step <= whole + (fraction > 0 ? 1 : 0); step++)
    for (let axis = 0; axis < 3; axis++) {
      travel[axis] =
        (travel[axis] + acceleration[axis] / TICK_RATE) * Math.max(0, 1 - drag[axis] / TICK_RATE);
      position[axis] += (travel[axis] / TICK_RATE) * (step <= whole ? 1 : fraction);
    }
  return { position, travel };
}
