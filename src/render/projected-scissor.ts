import * as THREE from 'three';

/** Conservative physical-pixel bounds. Near-plane crossings require an uncropped pass. */
export function projectedScissor(box: THREE.Box3, clip: THREE.Matrix4, size: THREE.Vector2) {
  const point = new THREE.Vector4();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z, 1).applyMatrix4(clip);
        if (point.w <= 0 || point.z <= -point.w) return null;
        const px = ((point.x / point.w) * 0.5 + 0.5) * size.x,
          py = ((point.y / point.w) * 0.5 + 0.5) * size.y;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
  // Cover sampling/rounding at the projected edge without changing depth texture resolution.
  const x = Math.max(0, Math.min(size.x, Math.floor(minX) - 2));
  const y = Math.max(0, Math.min(size.y, Math.floor(minY) - 2));
  const right = Math.max(0, Math.min(size.x, Math.ceil(maxX) + 2));
  const top = Math.max(0, Math.min(size.y, Math.ceil(maxY) + 2));
  return new THREE.Vector4(x, y, Math.max(0, right - x), Math.max(0, top - y));
}
