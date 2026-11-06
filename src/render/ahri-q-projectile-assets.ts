import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/ahri-q-projectile-particles.json';
import { ahriQCastAssets, loadAhriQCastAssets } from './ahri-q-cast-assets';
import { checkedAssetBytes } from './authored-mip-texture';
import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const cache = new AuthoredMipTextureCache(),
  textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>(),
  meshes = new Map<string, THREE.BufferGeometry>();
let pending: Promise<void> | undefined,
  ready = false;
export function ahriQProjectileAssets(): EclipseSurfaceAssets | undefined {
  return ready ? assets : undefined;
}
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (path === '') return white;
    if (data.textures.some((a) => a.url === path && a.textureOwner === 'ahri-q-cast'))
      return ahriQCastAssets()!.texture(path, address);
    if (![0, 1, 2].includes(address)) throw RangeError('Unsupported Ahri Q texture address');
    const id = `${path}:${address}`;
    let result = samplers.get(id);
    if (!result) {
      const source = textures.get(path);
      if (!source) throw Error('Missing Ahri Q texture: ' + path);
      result = source.clone();
      result.wrapS = result.wrapT = [
        THREE.RepeatWrapping,
        THREE.MirroredRepeatWrapping,
        THREE.ClampToEdgeWrapping,
      ][address];
      result.needsUpdate = true;
      samplers.set(id, result);
    }
    return result;
  },
  mesh(path) {
    if (data.meshes.some((a) => a.url === path && a.geometryOwner === 'ahri-q-cast'))
      return ahriQCastAssets()!.mesh(path);
    const geometry = meshes.get(path);
    if (!geometry) throw Error('Missing Ahri Q mesh: ' + path);
    return geometry;
  },
};
/** Borrowed caster resources stay caster-owned. Page-owned immutable resources. Explicit retries preserve verified successes. */
export function loadAhriQProjectileAssets(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      loadAhriQCastAssets(),
      ...data.textures
        .filter((a) => a.textureOwner !== 'ahri-q-cast' && !textures.has(a.url))
        .map(async (a) => {
          textures.set(a.url, await cache.load(a, false));
        }),
      ...data.meshes
        .filter((a) => a.geometryOwner !== 'ahri-q-cast' && !meshes.has(a.url))
        .map(async (a) => {
          const raw = await checkedAssetBytes(a.url, a.bytes, a.sha256),
            gltf = await new GLTFLoader().parseAsync(raw, '');
          const found: THREE.Mesh[] = [];
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((node) => {
            if (node instanceof THREE.Mesh) found.push(node);
          });
          try {
            if (found.length !== 1 || !found[0].matrixWorld.equals(new THREE.Matrix4()))
              throw Error('Ahri Q projectile requires one untransformed source mesh');
            const geometry = found[0].geometry,
              color = geometry.getAttribute('color');
            if (color && color.itemSize !== 4) throw Error('Invalid Ahri Q source RGBA');
            // The sphere source has no color stream: preserve that absence.
            if (color) {
              const bgra = new Uint8Array(color.count * 4);
              for (let i = 0; i < color.count; i++) {
                bgra.set(
                  [color.getZ(i), color.getY(i), color.getX(i), color.getW(i)].map((v) =>
                    Math.round(v * 255)
                  ),
                  i * 4
                );
              }
              geometry.setAttribute(
                '_source_vertex_bgra',
                new THREE.Uint8BufferAttribute(bgra, 4, true)
              );
            }
            // Only owned geometry is converted; borrowed caster meshes are already in metres.
            geometry.scale(0.01, 0.01, 0.01);
            meshes.set(a.url, geometry);
          } catch (error) {
            for (const node of found) node.geometry.dispose();
            throw error;
          } finally {
            for (const node of found)
              for (const m of Array.isArray(node.material) ? node.material : [node.material])
                m.dispose();
          }
        }),
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
