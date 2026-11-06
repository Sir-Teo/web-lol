import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/ahri-q-cast-particles.json';
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
export function ahriQCastAssets(): EclipseSurfaceAssets | undefined {
  return ready ? assets : undefined;
}
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (path === '') return white;
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
    const geometry = meshes.get(path);
    if (!geometry) throw Error('Missing Ahri Q mesh: ' + path);
    return geometry;
  },
};
/** Page-owned immutable resources. Explicit retries preserve verified successes. */
export function loadAhriQCastAssets(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      ...data.textures
        .filter((a) => !textures.has(a.url))
        .map(async (a) => {
          textures.set(a.url, await cache.load(a, false));
        }),
      ...data.meshes
        .filter((a) => !meshes.has(a.url))
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
              throw Error('Ahri Q requires one untransformed source mesh');
            const geometry = found[0].geometry,
              color = geometry.getAttribute('color');
            if (!color || color.itemSize !== 4) throw Error('Missing Ahri Q source RGBA');
            const bgra = new Uint8Array(color.count * 4);
            for (let i = 0; i < color.count; i++) {
              bgra.set(
                [color.getZ(i), color.getY(i), color.getX(i), color.getW(i)].map((v) =>
                  Math.round(v * 255)
                ),
                i * 4
              );
            }
            // Transport retains native centimetres; placement consumes scene metres.
            geometry.scale(0.01, 0.01, 0.01);
            geometry.setAttribute(
              '_source_vertex_bgra',
              new THREE.Uint8BufferAttribute(bgra, 4, true)
            );
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
