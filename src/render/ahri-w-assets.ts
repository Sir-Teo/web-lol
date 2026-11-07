import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/ahri-w-particles.json';
import { ahriQCastAssets } from './ahri-q-cast-assets';
import { ahriQProjectileAssets, loadAhriQProjectileAssets } from './ahri-q-projectile-assets';
import { checkedAssetBytes } from './authored-mip-texture';
import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

const needed = new Set<string>();
function collect(value: unknown): void {
  if (typeof value === 'string' && value.startsWith('assets/effects/')) needed.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
const joined = data.profiles.filter((p) => ['orbit', 'flight', 'hit'].includes(p.role));
joined.forEach(collect);
const requiredTextures = data.textures.filter((a) => needed.has(a.url));
const requiredMeshes = data.meshes.filter((a) => needed.has(a.url));
if (joined.length !== 23 || requiredTextures.length !== 30 || requiredMeshes.length !== 1)
  throw Error('W joined asset closure differs');

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const cache = new AuthoredMipTextureCache(),
  textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>(),
  meshes = new Map<string, THREE.BufferGeometry>();
let pending: Promise<void> | undefined,
  ready = false;
export function ahriWAssets(): EclipseSurfaceAssets | undefined {
  return ready ? assets : undefined;
}
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (path === '') return white;
    const owner = requiredTextures.find((a) => a.url === path)?.textureOwner;
    if (owner === 'ahri-q-cast') return ahriQCastAssets()!.texture(path, address);
    if (owner === 'ahri-q-projectile') return ahriQProjectileAssets()!.texture(path, address);
    if (![0, 1, 2].includes(address)) throw RangeError('Unsupported Ahri W texture address');
    const id = `${path}:${address}`;
    let result = samplers.get(id);
    if (!result) {
      const source = textures.get(path);
      if (!source) throw Error('Missing Ahri W texture: ' + path);
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
    if (!geometry) throw Error('Missing Ahri W mesh: ' + path);
    return geometry;
  },
};
/** Page-owned assets for the 23 joined profiles. Q owners retain their textures;
 * cast-only images and geometry are not requested. Verified successes survive retries. */
export function loadAhriWAssets(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      loadAhriQProjectileAssets(),
      ...requiredTextures
        .filter((a) => a.textureOwner === 'ahri-w' && !textures.has(a.url))
        .map(async (a) => {
          textures.set(a.url, await cache.load(a, false));
        }),
      ...requiredMeshes
        .filter((a) => a.geometryOwner === 'ahri-w' && !meshes.has(a.url))
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
              throw Error('Ahri W projectile requires one untransformed source mesh');
            const geometry = found[0].geometry,
              color = geometry.getAttribute('color');
            if (!color || color.itemSize !== 4) throw Error('Invalid Ahri W source RGBA');
            // Both retained W meshes have an authored RGBA color stream.
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
            // Convert the retained source coordinates to metres once for the owned geometry.
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
