interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Intersect the forward ray with a vertical cylinder, including its two caps. */
export function intersectsSelectionCylinder(
  ray: { origin: Point3; direction: Point3 },
  base: Point3,
  radius: number,
  height: number
): boolean {
  const ox = ray.origin.x - base.x,
    oz = ray.origin.z - base.z;
  const { x: dx, y: dy, z: dz } = ray.direction;
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  let near = 0,
    far = Infinity;
  if (a < 1e-12) {
    if (c > 0) return false;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;
    const root = Math.sqrt(discriminant);
    near = Math.max(near, (-b - root) / (2 * a));
    far = Math.min(far, (-b + root) / (2 * a));
  }
  if (Math.abs(dy) < 1e-12) {
    if (ray.origin.y < base.y || ray.origin.y > base.y + height) return false;
  } else {
    const bottom = (base.y - ray.origin.y) / dy;
    const top = (base.y + height - ray.origin.y) / dy;
    near = Math.max(near, Math.min(bottom, top));
    far = Math.min(far, Math.max(bottom, top));
  }
  return near <= far;
}
