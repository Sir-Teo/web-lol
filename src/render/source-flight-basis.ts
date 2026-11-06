/** Pinned external missile frame: local +Y follows travel, local X stays level.
 * This is an orientation adapter; it does not choose a flight height or path. */
export function sourceFlightBasis(direction: ArrayLike<number>): Float32Array {
  if (direction.length !== 3 || !Array.from(direction).every(Number.isFinite))
    throw RangeError('Invalid source flight direction');
  const across = Math.hypot(direction[0], direction[2]),
    length = Math.hypot(across, direction[1]);
  if (!Number.isFinite(length)) throw RangeError('Invalid source flight magnitude');
  if (length === 0) return new Float32Array([-1, 0, 0, 0, 0, 1, 0, 1, 0]);
  if (across === 0 && direction[1] > 0) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const [dx, dy, dz] = [direction[0] / length, direction[1] / length, direction[2] / length];
  const [lx, lz] = across === 0 ? [-1, 0] : [-direction[2] / across, direction[0] / across];
  const [ux, uy, uz] = [-dy * lz, lz * dx - lx * dz, lx * dy];
  return new Float32Array([lx, dx, ux, 0, dy, uy, lz, dz, uz]);
}
