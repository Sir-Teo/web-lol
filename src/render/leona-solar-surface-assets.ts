import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SOLAR_PROFILES } from './leona-solar-particles';
import { solarSurfaceAccepted } from './leona-solar-surface-profiles';
import { loadLuxParticleTextures } from './lux-particle-textures';

import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
let assets: EclipseSurfaceAssets | undefined, pending: Promise<void> | undefined;
export function solarSurfaceAssets() {
  return assets;
}
export function loadLeonaSolarSurfaces(): Promise<void> {
  return (pending ??= (async () => {
    const profiles = SOLAR_PROFILES.filter((_p, index) => solarSurfaceAccepted(index)),
      meshes = new Map<string, THREE.BufferGeometry>(),
      samplers = new Map<string, THREE.Texture>();
    const paths = new Set(
      profiles.flatMap((p) => [
        p.texture,
        p.lookup ?? '',
        p.multiplier?.texture ?? '',
        p.erosion?.texture ?? '',
        p.distortion?.texture ?? '',
      ])
    );
    const results = await Promise.allSettled([
      loadLuxParticleTextures([...paths].filter((p): p is string => !!p)),
      ...[...new Set(profiles.flatMap((p) => (p.mesh ? [p.mesh] : [])))].map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        let geometry: THREE.BufferGeometry | undefined;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          if (geometry || !node.matrixWorld.equals(new THREE.Matrix4()))
            throw Error('Solar SCB package must contain one untransformed source mesh');
          geometry = node.geometry;
          meshes.set(path, node.geometry);
          for (const m of Array.isArray(node.material) ? node.material : [node.material])
            m.dispose();
        });
        if (!geometry) throw Error('Missing Solar source mesh: ' + path);
      }),
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      for (const geometry of meshes.values()) geometry.dispose();
      throw failed.reason;
    }
    const source = (results[0] as PromiseFulfilledResult<Map<string, THREE.Texture>>).value;
    assets = {
      texture(path, address = 0) {
        if (address < 0 || address > 2) throw RangeError('Unsupported Solar source address mode');
        const key = path + ':' + address;
        let texture = samplers.get(key);
        if (!texture) {
          const image = source.get(path);
          if (!image) throw Error('Missing Solar source image: ' + path);
          texture = image.clone();
          texture.wrapS = texture.wrapT = [
            THREE.RepeatWrapping,
            THREE.MirroredRepeatWrapping,
            THREE.ClampToEdgeWrapping,
          ][address];
          texture.needsUpdate = true;
          samplers.set(key, texture);
        }
        return texture;
      },
      mesh(path) {
        const geometry = meshes.get(path);
        if (!geometry) throw Error('Missing Solar source geometry: ' + path);
        return geometry;
      },
    };
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
