import * as THREE from 'three';
import type { Vec2 } from '../simulation/math';

export interface GroundQuad {
  origin: Vec2;
  target: Vec2;
  /** Source coordinates and half-extents, before the cast-frame transform. */
  offset: readonly number[];
  halfSize: readonly number[];
  rotation: readonly number[];
  /** Missile local Y follows horizontal travel and local Z points down. */
  attachment?: 'missile';
}

/** Local vertical-projection policy, not a verified native ground_layer technique.
 * Rotate the authored quad with Ry Rx Rz, place it in the cast frame, then project
 * each grid vertex onto the battlefield height field. Source Y is intentionally
 * removed by projection; it must not become an offset below the terrain.
 * Heights and dimensions are source units; returned geometry uses world units. */
export function projectGroundQuad(
  geometry: THREE.BufferGeometry,
  quad: GroundQuad,
  heightAt: (point: Vec2) => number,
  maxEdge = 50,
  lift = 2,
  subdivisions?: readonly [number, number]
): void {
  const { origin, target, offset, halfSize, rotation } = quad;
  if (
    offset.length !== 3 ||
    halfSize.length < 2 ||
    rotation.length !== 3 ||
    ![
      origin.x,
      origin.y,
      target.x,
      target.y,
      ...offset,
      ...halfSize,
      ...rotation,
      maxEdge,
      lift,
    ].every(Number.isFinite) ||
    maxEdge <= 0
  )
    throw new RangeError('Invalid ground quad');
  const length = Math.hypot(target.x - origin.x, target.y - origin.y);
  if (!length || !halfSize[0] || !halfSize[1]) {
    geometry.setDrawRange(0, 0);
    return;
  }
  const nx = subdivisions?.[0] ?? Math.max(1, Math.ceil((Math.abs(halfSize[0]) * 2) / maxEdge));
  const ny = subdivisions?.[1] ?? Math.max(1, Math.ceil((Math.abs(halfSize[1]) * 2) / maxEdge));
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 1 || ny < 1 || nx > 256 || ny > 256)
    throw new RangeError('Ground quad exceeds projection grid budget');
  const vertices = (nx + 1) * (ny + 1);
  let position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const topology = `${nx}:${ny}`;
  // Index-only topology changes also replace a GPU buffer, even at equal vertex counts.
  if (
    !position ||
    position.count !== vertices ||
    !uv ||
    uv.count !== vertices ||
    geometry.userData.groundQuadTopology !== topology
  )
    geometry.dispose();
  if (!position || position.count !== vertices || !uv || uv.count !== vertices) {
    position = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(
      THREE.DynamicDrawUsage
    );
    uv = new THREE.BufferAttribute(new Float32Array(vertices * 2), 2);
    geometry.setAttribute('position', position);
    geometry.setAttribute('uv', uv);
  }
  if (geometry.userData.groundQuadTopology !== topology) {
    const indices: number[] = [];
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const a = y * (nx + 1) + x,
          b = a + 1,
          c = a + nx + 2,
          d = a + nx + 1;
        indices.push(a, b, c, a, c, d);
      }
    geometry.setIndex(indices);
    geometry.userData.groundQuadTopology = topology;
  }
  const [rx, ry, rz] = rotation.map((v) => (v * Math.PI) / 180);
  const sx = Math.sin(rx),
    cx = Math.cos(rx),
    cy = Math.cos(ry),
    sy = Math.sin(ry),
    cz = Math.cos(rz),
    sz = Math.sin(rz);
  const forward = { x: (target.x - origin.x) / length, y: (target.y - origin.y) / length };
  const across = { x: -forward.y, y: forward.x };
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const u = x / nx,
        v = y / ny,
        localX = (u * 2 - 1) * halfSize[0],
        localY = (v * 2 - 1) * halfSize[1];
      const sourceX =
        offset[0] + (cy * cz + sy * sx * sz) * localX + (-cy * sz + sy * sx * cz) * localY;
      const sourceZ =
        quad.attachment === 'missile'
          ? offset[1] + cx * sz * localX + cx * cz * localY
          : offset[2] + (-sy * cz + cy * sx * sz) * localX + (sy * sz + cy * sx * cz) * localY;
      const point = {
        x: origin.x + across.x * sourceX + forward.x * sourceZ,
        y: origin.y + across.y * sourceX + forward.y * sourceZ,
      };
      const height = heightAt(point);
      if (!Number.isFinite(height)) throw new RangeError('Invalid projected ground height');
      const at = y * (nx + 1) + x;
      position.setXYZ(at, point.x * 0.01, (height + lift) * 0.01, point.y * 0.01);
      // Authored arbitrary-quad UVs: source local Y is U and reversed X is V.
      uv.setXY(at, v, 1 - u);
    }
  position.needsUpdate = uv.needsUpdate = true;
  geometry.setDrawRange(0, nx * ny * 6);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
