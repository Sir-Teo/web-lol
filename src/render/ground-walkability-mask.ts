import type { BufferGeometry } from 'three';
import type { Vec2 } from '../simulation/math';
const originals = new WeakMap<BufferGeometry, { topology: unknown; indices: number[] }>();
/** Local conservative walkability mask, not native navmesh-texture equivalence.
 * Project first. Keep the full index capacity and retire triangles touching an
 * unwalkable vertex/centroid; later projections can restore previously hidden cells. */
export function maskGroundWalkability(geometry: BufferGeometry, walkable: (p: Vec2) => boolean) {
  const index = geometry.getIndex(),
    position = geometry.getAttribute('position');
  if (!index || !position) return;
  let original = originals.get(geometry);
  if (!original || original.topology !== geometry.userData.groundQuadTopology) {
    original = { topology: geometry.userData.groundQuadTopology, indices: Array.from(index.array) };
    originals.set(geometry, original);
  }
  const point = (i: number) => ({ x: position.getX(i) * 100, y: position.getZ(i) * 100 });
  let at = 0;
  for (let i = 0; i < original.indices.length; i += 3) {
    const ids = original.indices.slice(i, i + 3),
      p = ids.map(point),
      center = { x: (p[0].x + p[1].x + p[2].x) / 3, y: (p[0].y + p[1].y + p[2].y) / 3 };
    if (!p.every(walkable) || !walkable(center)) continue;
    for (const id of ids) index.setX(at++, id);
  }
  index.needsUpdate = true;
  geometry.setDrawRange(0, at);
}
