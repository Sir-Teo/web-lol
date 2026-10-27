import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { checkedAssetBytes } from './authored-mip-texture';
export interface StaticGeometryAsset {
  url: string;
  bytes: number;
  sha256: string;
}
/** Static effect GLBs have one untransformed, unskinned mesh. Materials are not borrowed. */
export async function loadAuthoredStaticGeometry(
  asset: StaticGeometryAsset
): Promise<THREE.BufferGeometry> {
  const bytes = await checkedAssetBytes(asset.url, asset.bytes, asset.sha256),
    gltf = await new GLTFLoader().parseAsync(bytes, import.meta.env.BASE_URL);
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  let count = 0,
    unsupported = false;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    count++;
    geometries.add(node.geometry);
    unsupported ||=
      node instanceof THREE.SkinnedMesh || !node.matrixWorld.equals(new THREE.Matrix4());
    for (const material of Array.isArray(node.material) ? node.material : [node.material])
      materials.add(material);
  });
  for (const material of materials) material.dispose();
  if (count !== 1 || unsupported) {
    for (const geometry of geometries) geometry.dispose();
    throw Error('Invalid authored static mesh closure/transform');
  }
  return geometries.values().next().value!;
}
interface Entry {
  signature: string;
  promise: Promise<THREE.BufferGeometry>;
  geometry?: THREE.BufferGeometry;
}
/** One page owner; consumers borrow geometry. Failed loads can be explicitly retried. */
export class AuthoredStaticGeometryCache {
  private entries = new Map<string, Entry>();
  private closed = false;
  constructor(private loader = loadAuthoredStaticGeometry) {}
  load(asset: StaticGeometryAsset): Promise<THREE.BufferGeometry> {
    if (this.closed) return Promise.reject(Error('Authored geometry cache is disposed'));
    const signature = JSON.stringify([asset.bytes, asset.sha256]),
      previous = this.entries.get(asset.url);
    if (previous)
      return previous.signature === signature
        ? previous.promise
        : Promise.reject(Error('Conflicting shared authored geometry declaration: ' + asset.url));
    const entry: Entry = {
      signature,
      promise: Promise.resolve()
        .then(async () => {
          const geometry = await this.loader(asset);
          if (this.closed) {
            geometry.dispose();
            throw Error('Authored geometry cache disposed during load');
          }
          entry.geometry = geometry;
          return geometry;
        })
        .catch((error) => {
          if (this.entries.get(asset.url) === entry) this.entries.delete(asset.url);
          throw error;
        }),
    };
    this.entries.set(asset.url, entry);
    return entry.promise;
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.entries.values()) entry.geometry?.dispose();
    this.entries.clear();
  }
}
