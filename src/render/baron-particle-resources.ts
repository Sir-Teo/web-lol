import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
import { checkedAssetBytes } from './authored-mip-texture';
import {
  BARON_ATTACK_ASSET_ROOT,
  baronTextureAsset,
  loadBaronAttackAssets,
} from './baron-attack-assets';

/** One renderer owns these resources; particle batches borrow them. Emission
 * surfaces are already source-unit arrays in the program and never draw. */
export async function loadBaronParticleResources() {
  const program = await loadBaronAttackAssets(),
    cache = new AuthoredMipTextureCache();
  const textures = new Map<string, THREE.Texture>(),
    meshes = new Map<string, THREE.BufferGeometry>();
  const requiredMeshes = new Set(
    program.profiles.flatMap((p) => (p.geometry.kind === 'mesh' ? [p.geometry.asset] : []))
  );
  const lookup = new Set(
    program.profiles.flatMap((p) => (p.material.palette ? [p.material.palette.texture] : []))
  );
  const outcomes = await Promise.allSettled([
    ...program.textures.map(async (row) =>
      textures.set(
        row.source.wadPathHash,
        await cache.load(baronTextureAsset(row), lookup.has(row.source.wadPathHash))
      )
    ),
    ...Array.from(requiredMeshes, async (key) => {
      const row = program.meshes.find((m) => m.source.wadPathHash === key);
      if (!row) throw Error('Baron drawing mesh transport is missing');
      const bytes = await checkedAssetBytes(
        BARON_ATTACK_ASSET_ROOT + row.name,
        row.bytes,
        row.sha256
      );
      const gltf = await new GLTFLoader().parseAsync(bytes, '');
      const found: THREE.Mesh[] = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) found.push(node);
      });
      try {
        if (
          found.length !== 1 ||
          !found[0].matrixWorld.equals(new THREE.Matrix4()) ||
          found[0].geometry.index ||
          !found[0].geometry.hasAttribute('_source_vertex_bgra')
        )
          throw Error('Baron drawing mesh layout differs');
        meshes.set(key, found[0].geometry.clone());
      } finally {
        for (const mesh of found) {
          mesh.geometry.dispose();
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            material.dispose();
        }
      }
    }),
  ]);
  const dispose = () => {
    cache.dispose();
    meshes.forEach((g) => g.dispose());
    meshes.clear();
    textures.clear();
  };
  const failed = outcomes.find((r) => r.status === 'rejected');
  if (failed?.status === 'rejected') {
    dispose();
    throw failed.reason;
  }
  return { program, textures, meshes, dispose };
}
export type BaronParticleResources = Awaited<ReturnType<typeof loadBaronParticleResources>>;
