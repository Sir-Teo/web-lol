import * as THREE from 'three';
import type { PackedTrailVertex } from './source-packed-trail-ribbon';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
export type PackedRibbonMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
/** Owns uploaded ribbon buffers/materials; supplied textures remain page-owned. */
export class SourcePackedRibbonMeshes {
  readonly models = new Map<string, PackedRibbonMesh>();
  constructor(
    private scene: THREE.Scene,
    private material: (index: number, assets: EclipseSurfaceAssets) => THREE.ShaderMaterial,
    private profile: (index: number) => { name: string; renderOrder: number }
  ) {}
  write(
    key: string,
    index: number,
    vertices: readonly PackedTrailVertex[],
    assets: EclipseSurfaceAssets
  ) {
    let mesh = this.models.get(key);
    if (!vertices.length) {
      if (mesh) this.release(key, mesh);
      return null;
    }
    if (mesh && mesh.userData.profileIndex !== index)
      throw Error('Packed ribbon profile identity changed');
    if (!mesh) {
      const profile = this.profile(index);
      mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material(index, assets));
      mesh.name = profile.name;
      mesh.renderOrder = profile.renderOrder;
      mesh.frustumCulled = false;
      Object.assign(mesh.userData, { profileIndex: index, ownedGeometry: true, capacity: 0 });
      this.models.set(key, mesh);
      this.scene.add(mesh);
    }
    let geometry = mesh.geometry;
    if (mesh.userData.capacity < vertices.length) {
      geometry.dispose();
      geometry = mesh.geometry = new THREE.BufferGeometry();
      const capacity = Math.max(24, 2 ** Math.ceil(Math.log2(vertices.length)));
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['sourceTint', 4],
        ['sourceLookup', 2],
        ['sourceErosion', 1],
        ['sourceMultUv', 2],
        ['sourceCell', 2],
        ['sourceMultCell', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      mesh.userData.capacity = capacity;
    }
    const box = new THREE.Box3(),
      point = new THREE.Vector3();
    vertices.forEach((v, i) => {
      point.fromArray(v.position).multiplyScalar(0.01);
      box.expandByPoint(point);
      geometry.getAttribute('position').setXYZ(i, point.x, point.y, point.z);
      geometry.getAttribute('uv').setXY(i, v.uv[0], v.uv[1]);
      geometry
        .getAttribute('sourceTint')
        .setXYZW(i, v.color[0], v.color[1], v.color[2], v.color[3]);
      geometry.getAttribute('sourceLookup').setXY(i, v.lookup[0], v.lookup[1]);
      geometry.getAttribute('sourceErosion').setX(i, v.erosion);
      geometry.getAttribute('sourceMultUv').setXY(i, v.multUv?.[0] ?? 0, v.multUv?.[1] ?? 0);
      geometry.getAttribute('sourceCell').setXY(i, v.cell[0], v.cell[1]);
      geometry.getAttribute('sourceMultCell').setXY(i, v.multCell?.[0] ?? 0, v.multCell?.[1] ?? 0);
    });
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    geometry.setDrawRange(0, vertices.length);
    geometry.boundingBox = box;
    geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    return mesh;
  }
  retain(keys: ReadonlySet<string>) {
    for (const [key, mesh] of this.models) if (!keys.has(key)) this.release(key, mesh);
  }
  private release(key: string, mesh: PackedRibbonMesh) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
    this.models.delete(key);
  }
  dispose() {
    for (const [key, mesh] of this.models) this.release(key, mesh);
  }
}
