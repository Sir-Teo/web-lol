import * as THREE from 'three';

export interface DecalFootprint {
  center: readonly [number, number, number];
  halfWidth: number;
  halfHeight: number;
  turn: number;
  /** Explicit source-X reflection about the projector center. */
  reflectX?: boolean;
}
function validFootprint(p: DecalFootprint) {
  if (
    ![...p.center, p.halfWidth, p.halfHeight, p.turn].every(Number.isFinite) ||
    p.halfWidth <= 0 ||
    p.halfHeight <= 0
  )
    throw RangeError('Invalid decal footprint');
}
/** Algebraic inverse of an explicit flat XZ footprint, with native row0/row2
 * UV storage. This candidate construction is not recovered native CPU code. */
export function decalWorldToUv(p: DecalFootprint) {
  validFootprint(p);
  const [x, , z] = p.center,
    c = Math.cos(p.turn),
    s = Math.sin(p.turn),
    mirror = p.reflectX ? -1 : 1,
    a = 2 * p.halfWidth,
    b = 2 * p.halfHeight;
  const matrix = new THREE.Matrix4().set(
    (mirror * c) / a,
    0,
    s / a,
    0.5 - (mirror * c * x + s * z) / a,
    0,
    1,
    0,
    0,
    (-mirror * s) / b,
    0,
    c / b,
    0.5 + (mirror * s * x - c * z) / b,
    0,
    0,
    0,
    1
  );
  if (!matrix.elements.every(Number.isFinite)) throw RangeError('Non-finite decal matrix');
  return matrix;
}
interface Corner {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
}
function clip(polygon: Corner[], axis: 'u' | 'v', bound: number, above: boolean) {
  const out: Corner[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      insideA = above ? a[axis] >= bound : a[axis] <= bound,
      insideB = above ? b[axis] >= bound : b[axis] <= bound;
    if (insideA) out.push(a);
    if (insideA === insideB) continue;
    const t = (bound - a[axis]) / (b[axis] - a[axis]),
      hit = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        u: a.u + (b.u - a.u) * t,
        v: a.v + (b.v - a.v) * t,
      };
    hit[axis] = bound;
    out.push(hit);
  }
  return out;
}

export type DecalReceiverFilter = (mesh: THREE.Mesh, material: THREE.Material) => boolean;

/** Local terrain policy. The imported Rift artifact masks every material,
 * including its named ground patches; alphaTest=0 would select no map at all.
 * Select only those explicit ground names there, excluding vegetation/props.
 * Native receiver masks and treatment of terrain texture holes remain unknown. */
export function terrainDecalReceiver(
  mesh: THREE.Mesh,
  material: THREE.Material,
  terrain: 'rift' | 'practice-fixture'
) {
  return (
    !(mesh instanceof THREE.SkinnedMesh) &&
    !(mesh instanceof THREE.InstancedMesh) &&
    !(mesh instanceof THREE.BatchedMesh) &&
    !mesh.morphTargetInfluences?.some((v) => v !== 0) &&
    !material.transparent &&
    material.depthWrite &&
    (terrain === 'rift'
      ? /^Maps\/KitPieces\/SRS\/Base\/Materials\/Default\/(?:Ground_|HOL2026_Ground_|Earth_(?:Order|Chaos)_Gromp_A_MAT$)/.test(
          material.name
        )
      : material.alphaTest === 0)
  );
}

/** A lazy snapshot of explicitly selected, visible static receiver triangles.
 * Copies only positions into world units, folds source/parent transforms once,
 * and clips those same triangles in projector UV space. It never samples a
 * height field, generates a substitute ground plane or invents normals.
 * Source objects/geometry/materials remain borrowed. Callers invalidate after
 * changing transforms, topology, visibility or receiver eligibility.
 * Spatial cells and eligibility/clipping are local CPU reconstruction policies. */
export class ParticleDecalReceivers {
  private triangles?: Float64Array;
  private cells = new Map<string, Uint32Array>();
  constructor(
    private roots: readonly THREE.Object3D[],
    private accepts: DecalReceiverFilter,
    private cellSize: number
  ) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw RangeError('Invalid receiver cell size');
  }
  invalidate(roots = this.roots) {
    this.roots = roots;
    this.triangles = undefined;
    this.cells.clear();
  }
  get triangleCount() {
    return this.triangles ? this.triangles.length / 9 : 0;
  }
  private build() {
    const vertices: number[] = [],
      visited = new Set<THREE.Mesh>(),
      bins = new Map<string, number[]>(),
      point = new THREE.Vector3();
    for (const root of this.roots) {
      root.updateWorldMatrix(true, true);
      root.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (visited.has(object)) return;
        visited.add(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material],
          geometry = object.geometry,
          position = geometry.getAttribute('position'),
          index = geometry.getIndex(),
          count = index?.count ?? position?.count ?? 0,
          start = geometry.drawRange.start,
          end = Math.min(count, start + geometry.drawRange.count),
          groups = geometry.groups.length
            ? geometry.groups
            : [{ start: 0, count, materialIndex: 0 }];
        if (!materials.some((m) => m.visible && this.accepts(object, m))) return;
        if (
          object instanceof THREE.SkinnedMesh ||
          object instanceof THREE.InstancedMesh ||
          object instanceof THREE.BatchedMesh ||
          object.morphTargetInfluences?.some((v) => v !== 0)
        )
          throw Error('Decal receivers require explicit static meshes');
        if (!position || position.itemSize !== 3) throw Error('Receiver lacks triangle positions');
        const matrix = object.matrixWorld,
          e = matrix.elements;
        if (!e.every(Number.isFinite) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || e[15] !== 1)
          throw Error('Receiver requires a finite affine world transform');
        for (const group of groups) {
          const material = materials[group.materialIndex ?? 0];
          if (!material) throw Error('Receiver group lacks a material');
          if (!material.visible || !this.accepts(object, material)) continue;
          const first = Math.max(start, group.start),
            last = Math.min(end, group.start + group.count);
          if (first >= last) continue;
          if (first % 3 !== 0 || (last - first) % 3 !== 0)
            throw Error('Receiver requires complete triangles');
          for (let at = first; at < last; at += 3) {
            const triangle: number[] = [],
              xs: number[] = [],
              zs: number[] = [];
            for (let corner = 0; corner < 3; corner++) {
              const i = index ? index.getX(at + corner) : at + corner;
              if (!Number.isInteger(i) || i < 0 || i >= position.count)
                throw Error('Invalid receiver index');
              point.fromBufferAttribute(position, i).applyMatrix4(matrix);
              if (!point.toArray().every(Number.isFinite))
                throw Error('Non-finite receiver position');
              triangle.push(point.x, point.y, point.z);
              xs.push(point.x);
              zs.push(point.z);
            }
            const minX = Math.floor(Math.min(...xs) / this.cellSize),
              maxX = Math.floor(Math.max(...xs) / this.cellSize),
              minZ = Math.floor(Math.min(...zs) / this.cellSize),
              maxZ = Math.floor(Math.max(...zs) / this.cellSize);
            if (
              ![minX, maxX, minZ, maxZ].every(Number.isSafeInteger) ||
              (maxX - minX + 1) * (maxZ - minZ + 1) > 65536
            )
              throw RangeError('Receiver triangle exceeds spatial cell budget');
            const id = vertices.length / 9;
            vertices.push(...triangle);
            for (let x = minX; x <= maxX; x++)
              for (let z = minZ; z <= maxZ; z++) {
                const key = `${x}:${z}`;
                let bin = bins.get(key);
                if (!bin) bins.set(key, (bin = []));
                bin.push(id);
              }
          }
        }
      });
    }
    this.triangles = new Float64Array(vertices);
    this.cells = new Map([...bins].map(([key, ids]) => [key, new Uint32Array(ids)]));
  }
  /** Writes owned nonindexed world-space triangles; the caller supplies identity
   * decalWorld. Buffer capacity grows in complete-triangle powers of two. */
  write(geometry: THREE.BufferGeometry, footprint: DecalFootprint) {
    const mapping = decalWorldToUv(footprint),
      m = mapping.elements,
      [cx, , cz] = footprint.center,
      c = Math.cos(footprint.turn),
      s = Math.sin(footprint.turn),
      dx = Math.abs(c) * footprint.halfWidth + Math.abs(s) * footprint.halfHeight,
      dz = Math.abs(s) * footprint.halfWidth + Math.abs(c) * footprint.halfHeight,
      minX = Math.floor((cx - dx) / this.cellSize),
      maxX = Math.floor((cx + dx) / this.cellSize),
      minZ = Math.floor((cz - dz) / this.cellSize),
      maxZ = Math.floor((cz + dz) / this.cellSize);
    if (
      ![minX, maxX, minZ, maxZ].every(Number.isSafeInteger) ||
      (maxX - minX + 1) * (maxZ - minZ + 1) > 65536
    )
      throw RangeError('Decal footprint exceeds spatial cell budget');
    if (!this.triangles) this.build();
    const candidates = new Set<number>(),
      out: number[] = [];
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++)
        for (const id of this.cells.get(`${x}:${z}`) ?? []) candidates.add(id);
    for (const id of [...candidates].sort((a, b) => a - b)) {
      let polygon: Corner[] = [];
      for (let i = 0; i < 3; i++) {
        const at = id * 9 + i * 3,
          x = this.triangles![at],
          y = this.triangles![at + 1],
          z = this.triangles![at + 2];
        polygon.push({ x, y, z, u: m[0] * x + m[8] * z + m[12], v: m[2] * x + m[10] * z + m[14] });
      }
      for (const [axis, bound, above] of [
        ['u', 0, true],
        ['u', 1, false],
        ['v', 0, true],
        ['v', 1, false],
      ] as const)
        polygon = clip(polygon, axis, bound, above);
      for (let i = 1; i + 1 < polygon.length; i++) {
        const a = polygon[0],
          b = polygon[i],
          c = polygon[i + 1],
          ux = b.x - a.x,
          uy = b.y - a.y,
          uz = b.z - a.z,
          vx = c.x - a.x,
          vy = c.y - a.y,
          vz = c.z - a.z;
        if ((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2 === 0)
          continue;
        for (const p of [a, b, c]) out.push(p.x, p.y, p.z);
      }
    }
    let position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (out.length && (!position || position.array.length < out.length)) {
      geometry.dispose();
      const triangles = 2 ** Math.ceil(Math.log2(out.length / 9));
      position = new THREE.BufferAttribute(new Float32Array(triangles * 9), 3).setUsage(
        THREE.DynamicDrawUsage
      );
      geometry.setAttribute('position', position);
    }
    if (position) {
      (position.array as Float32Array).set(out);
      position.needsUpdate = true;
    }
    geometry.setIndex(null);
    geometry.setDrawRange(0, out.length / 3);
    const bounds = new THREE.Box3(),
      point = new THREE.Vector3();
    for (let i = 0; i < out.length; i += 3) bounds.expandByPoint(point.fromArray(out, i));
    geometry.boundingBox = bounds;
    geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    return {
      corners: out.length / 3,
      candidates: candidates.size,
      sourceTriangles: this.triangleCount,
      mapping,
    };
  }
}
