export interface SourceBirthPlacementInput {
  base: ArrayLike<number>;
  offset: ArrayLike<number>;
  turn: ArrayLike<number>;
  turned: boolean;
  velocity: ArrayLike<number>;
  acceleration: ArrayLike<number>;
  surface: { position: ArrayLike<number>; normal: ArrayLike<number> } | null;
  surfaceScale: number;
  useNormal: boolean;
  offsetScale: number;
}
/** Source-unit placement after shape sampling. Surface writes round to float32;
 * a requested normal replaces direction with normal times the vector's length.
 * The shape turn acts on these vectors last. Offset is already shape-turned and
 * is not turned again. Actor transforms and the bound-size factor are supplied
 * separately; neither is inferred from a gameplay radius here. */
export function sourceBirthPlacement(input: SourceBirthPlacementInput) {
  const vector = (value: ArrayLike<number>, width: number) => {
    if (
      value.length !== width ||
      !Array.from(value).every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v)))
    )
      throw RangeError('Invalid source birth placement vector');
    return Float32Array.from(value);
  };
  const base = vector(input.base, 3),
    offset = vector(input.offset, 3),
    turn = vector(input.turn, 9);
  const velocity = vector(input.velocity, 3),
    acceleration = vector(input.acceleration, 3);
  if (
    ![input.surfaceScale, input.offsetScale].every(Number.isFinite) ||
    ![input.turned, input.useNormal].every((v) => typeof v === 'boolean')
  )
    throw RangeError('Invalid source birth placement policy');
  const surface = input.surface
    ? { position: vector(input.surface.position, 3), normal: vector(input.surface.normal, 3) }
    : null;
  for (let axis = 0; axis < 3; axis++) offset[axis] *= input.offsetScale;
  if (surface) {
    for (let axis = 0; axis < 3; axis++) base[axis] += surface.position[axis] * input.surfaceScale;
    if (input.useNormal)
      for (const value of [velocity, acceleration]) {
        const length = Math.hypot(...value);
        for (let axis = 0; axis < 3; axis++) value[axis] = surface.normal[axis] * length;
      }
  }
  if (input.turned)
    for (const value of [velocity, acceleration]) {
      const [x, y, z] = value;
      for (let axis = 0; axis < 3; axis++)
        value[axis] = turn[axis * 3] * x + turn[axis * 3 + 1] * y + turn[axis * 3 + 2] * z;
    }
  const position = new Float32Array(3);
  for (let axis = 0; axis < 3; axis++) position[axis] = base[axis] + offset[axis];
  return { position, velocity, acceleration, offset };
}
