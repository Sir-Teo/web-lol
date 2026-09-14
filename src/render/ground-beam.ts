import type * as THREE from 'three';
import type { Vec2 } from '../simulation/math';
import { projectGroundQuad } from './ground-quad';

export interface GroundBeam {
  origin: Vec2;
  target: Vec2;
  halfWidth: number;
  /** Axial source-space endpoint offsets along the captured cast direction. */
  sourceOffset: number;
  targetOffset: number;
}
/** Terrain-projected beam strip: U spans width, V spans source to target. The
 * local vertical projection policy is shared with ground quads; no camera basis
 * participates. maxHalfWidth keeps the grid fixed during source width animation. */
export function projectGroundBeam(
  geometry: THREE.BufferGeometry,
  beam: GroundBeam,
  heightAt: (point: Vec2) => number,
  maxHalfWidth = Math.abs(beam.halfWidth)
): void {
  const length = Math.hypot(beam.target.x - beam.origin.x, beam.target.y - beam.origin.y);
  if (!Number.isFinite(maxHalfWidth) || maxHalfWidth < Math.abs(beam.halfWidth))
    throw new RangeError('Invalid maximum ground beam width');
  const span = length + beam.targetOffset - beam.sourceOffset;
  if (span <= 0) {
    geometry.setDrawRange(0, 0);
    return;
  }
  projectGroundQuad(
    geometry,
    {
      origin: beam.origin,
      target: beam.target,
      offset: [0, 0, (length + beam.targetOffset + beam.sourceOffset) / 2],
      halfSize: [beam.halfWidth, span / 2],
      rotation: [90, 0, 0],
    },
    heightAt,
    50,
    2,
    [Math.max(1, Math.ceil((maxHalfWidth * 2) / 50)), Math.max(1, Math.ceil(span / 50))]
  );
  const uv = geometry.getAttribute('uv');
  if (!geometry.drawRange.count || !uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getY(i), uv.getX(i));
  uv.needsUpdate = true;
}
