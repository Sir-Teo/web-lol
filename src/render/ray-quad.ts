import * as THREE from 'three';

export interface RayQuad {
  /** World-space centre and orthonormal source axes after the game's reflection. */
  center: THREE.Vector3;
  axis: THREE.Vector3;
  fallbackAcross: THREE.Vector3;
  /** Full width, length and near-edge displacement, already in world units. */
  size: readonly [number, number, number];
}
const towardEye = new THREE.Vector3();
const across = new THREE.Vector3();
const corners = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const;

/** Write a VfxPrimitiveRay into existing particle buffers. The reflected source
 * frame reverses the cross product. When the eye lies on the ray's axis, use the
 * source X axis rather than an arbitrary camera-dependent direction.
 * Source rotation, attachment transforms and unit conversion belong to the caller.
 */
export function writeRayQuad(
  position: THREE.BufferAttribute,
  uv: THREE.BufferAttribute,
  firstVertex: number,
  ray: RayQuad,
  eye: THREE.Vector3
): void {
  if (
    !Number.isInteger(firstVertex) ||
    firstVertex < 0 ||
    position.itemSize !== 3 ||
    uv.itemSize !== 2 ||
    position.count < firstVertex + 6 ||
    uv.count < firstVertex + 6 ||
    ![...ray.center, ...ray.axis, ...ray.fallbackAcross, ...ray.size, ...eye].every(Number.isFinite)
  )
    throw new RangeError('Invalid ray quad buffers or input');
  towardEye.subVectors(eye, ray.center);
  across.crossVectors(ray.axis, towardEye);
  if (across.lengthSq() > 0) across.normalize().negate();
  else across.copy(ray.fallbackAcross);
  for (let i = 0; i < corners.length; i++) {
    const [x, y] = corners[i];
    const along = ray.size[2] + (y + 0.5) * ray.size[1],
      width = x * ray.size[0];
    position.setXYZ(
      firstVertex + i,
      ray.center.x + ray.axis.x * along + across.x * width,
      ray.center.y + ray.axis.y * along + across.y * width,
      ray.center.z + ray.axis.z * along + across.z * width
    );
    uv.setXY(firstVertex + i, x + 0.5, 0.5 - y);
  }
}
