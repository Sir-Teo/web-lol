export type SourceSpawnShape =
  | { kind: 'point'; offset: readonly [number, number, number] }
  | { kind: 'sphere'; radius: number; volume: boolean }
  | { kind: 'cylinder'; radius: number; height: number; volume: boolean };

/** Source-unit birth and the row-major shape turn, before emitter placement.
 * Uses the pinned external naive distributions, without uniform-volume fixes.
 * Legacy animated offsets/angles are sampled separately by their caller. */
export function sourceSpawnShape(shape: SourceSpawnShape, random: () => number) {
  const finite = (value: number) => Number.isFinite(value) && Number.isFinite(Math.fround(value));
  if (shape.kind === 'point') {
    if (shape.offset.length !== 3 || !shape.offset.every(finite))
      throw RangeError('Invalid source point offset');
  } else if (
    (shape.kind !== 'sphere' && shape.kind !== 'cylinder') ||
    !finite(shape.radius) ||
    typeof shape.volume !== 'boolean' ||
    (shape.kind === 'cylinder' && !finite(shape.height))
  )
    throw RangeError('Invalid source sphere/cylinder shape');
  const raw = new Float32Array(3),
    offset = new Float32Array(3);
  let turn = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    turned = false;
  const draw = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw RangeError('Shape random draw must be in [0, 1)');
    return value;
  };
  const spin = (axis: 'y' | 'z', radians: number) => {
    if (radians === 0) return;
    const c = Math.cos(radians),
      s = Math.sin(radians);
    const next = new Float32Array(
      axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]
    );
    const product = new Float32Array(9);
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 3; column++)
        product[row * 3 + column] =
          next[row * 3] * turn[column] +
          next[row * 3 + 1] * turn[3 + column] +
          next[row * 3 + 2] * turn[6 + column];
    turn = product;
    turned = true;
  };
  if (shape.kind === 'point') raw.set(shape.offset);
  else if (shape.kind === 'sphere') {
    raw[0] = (shape.volume ? draw() : 1) * shape.radius;
    spin('y', draw() * Math.PI * 2);
    spin('z', draw() * Math.PI * 2);
  } else {
    raw[0] = (shape.volume ? -1 + 2 * draw() : 1) * shape.radius;
    raw[1] = draw() * shape.height;
    spin('y', draw() * Math.PI * 2);
  }
  offset.set(raw);
  if (turned)
    for (let axis = 0; axis < 3; axis++)
      offset[axis] =
        turn[axis * 3] * raw[0] + turn[axis * 3 + 1] * raw[1] + turn[axis * 3 + 2] * raw[2];
  return { raw, offset, turn, turned };
}
