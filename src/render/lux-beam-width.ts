import { Vector3 } from 'three';

/** Default source beam width, after the source-Z reflection into render space.
 * The reflected cross(eye - source, target - source) becomes cross(delta, eye).
 */
export function luxBeamWidth(source: Vector3, target: Vector3, eye: Vector3): Vector3 {
  const direction = target.clone().sub(source);
  if (direction.lengthSq() === 0) return new Vector3();
  direction.normalize();
  const width = direction.clone().cross(eye.clone().sub(source));
  if (width.lengthSq() < 1e-12) {
    // Looking exactly along the beam has no unique facing; choose a stable side.
    const axis = Math.abs(direction.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    width.copy(direction).cross(axis);
  }
  return width.normalize();
}
