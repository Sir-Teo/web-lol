export interface StaticSurfaceBirth {
  position: [number, number, number];
  normal: [number, number, number];
  triangle: number;
}

/** Native source units in, source units out. This is the pinned external static
 * emission-mesh law, distinct from its uniform skinned-surface sampler. Source
 * emission scale, shape transforms and RNG ownership belong to the caller. */
export function staticEmissionSurface(positions: ArrayLike<number>, indices: ArrayLike<number>) {
  if (positions.length % 3 || indices.length % 3)
    throw RangeError('Invalid static emission mesh extents');
  const points = Float64Array.from(positions),
    corners = Uint32Array.from(indices);
  if (
    !points.every(Number.isFinite) ||
    Array.from(indices).some(
      (index) => !Number.isSafeInteger(index) || index < 0 || index * 3 >= points.length
    )
  )
    throw RangeError('Invalid static emission mesh vertex or index');
  const count = corners.length / 3,
    reach = new Float64Array(count);
  const normals: [number, number, number][] = [];
  let total = 0;
  for (let triangle = 0; triangle < count; triangle++) {
    const a = corners[triangle * 3] * 3,
      b = corners[triangle * 3 + 1] * 3,
      c = corners[triangle * 3 + 2] * 3;
    const ab = [
      points[b] - points[a],
      points[b + 1] - points[a + 1],
      points[b + 2] - points[a + 2],
    ];
    const ac = [
      points[c] - points[a],
      points[c + 1] - points[a + 1],
      points[c + 2] - points[a + 2],
    ];
    const normal: [number, number, number] = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    total += length / 2;
    if (!Number.isFinite(total)) throw RangeError('Static emission mesh area overflow');
    reach[triangle] = total;
    normals.push(
      length > 0 ? (normal.map((value) => value / length) as [number, number, number]) : normal
    );
  }
  return (random: () => number): StaticSurfaceBirth | null => {
    if (total < 1e-5) return null;
    const draw = () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw RangeError('Emission random draw must be in [0, 1)');
      return value;
    };
    const pick = draw() * total;
    let low = 0,
      high = count - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (pick >= reach[middle]) low = middle + 1;
      else high = middle;
    }
    const triangle = low,
      u = draw(),
      v = draw();
    // Deliberately not a square-root barycentric sample: the retained external
    // static-mesh reader concentrates births toward the third source corner.
    const weights = [(1 - u) * (1 - v), (1 - u) * v, u];
    const position: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++)
      position[axis] =
        points[corners[triangle * 3] * 3 + axis] * weights[0] +
        points[corners[triangle * 3 + 1] * 3 + axis] * weights[1] +
        points[corners[triangle * 3 + 2] * 3 + axis] * weights[2];
    return { position, normal: [...normals[triangle]], triangle };
  };
}
