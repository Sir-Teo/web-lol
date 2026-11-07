import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/ahri-e-particles.json';
import { ahriQCastAssets } from './ahri-q-cast-assets';
import { ahriQProjectileAssets } from './ahri-q-projectile-assets';
import { ahriWAssets, loadAhriWAssets } from './ahri-w-assets';
import { checkedAssetBytes } from './authored-mip-texture';
import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

const needed = new Set<string>();
function collect(value: unknown): void {
  if (typeof value === 'string' && value.startsWith('assets/effects/')) needed.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
const joined = data.profiles;
joined.forEach(collect);
const requiredTextures = data.textures.filter((a) => needed.has(a.url));
const requiredMeshes = data.meshes.filter((a) => needed.has(a.url));
if (joined.length !== 29 || requiredTextures.length !== 22 || requiredMeshes.length !== 2)
  throw Error('E joined asset closure differs');

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const cache = new AuthoredMipTextureCache(),
  textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>(),
  meshes = new Map<string, THREE.BufferGeometry>();
let pending: Promise<void> | undefined,
  ready = false;
export function ahriEAssets(): EclipseSurfaceAssets | undefined {
  return ready ? assets : undefined;
}
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (path === '') return white;
    if (![0, 1, 2].includes(address)) throw RangeError('Unsupported Ahri E texture address');
    const owner = requiredTextures.find((a) => a.url === path)?.textureOwner;
    if (owner === 'ahri-q-cast') return ahriQCastAssets()!.texture(path, address);
    if (owner === 'ahri-q-projectile') return ahriQProjectileAssets()!.texture(path, address);
    if (owner === 'ahri-w') return ahriWAssets()!.texture(path, address);
    const id = `${path}:${address}`;
    let result = samplers.get(id);
    if (!result) {
      const source = textures.get(path);
      if (!source) throw Error('Missing Ahri E texture: ' + path);
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
    if (!geometry) throw Error('Missing Ahri E mesh: ' + path);
    return geometry;
  },
};
/** Page-owned assets for all 29 joined profiles. Q/W owners retain their textures.
 * Verified successes survive retries; a failed load never exposes partial readiness. */
export function loadAhriEAssets(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      loadAhriWAssets(),
      ...requiredTextures
        .filter((a) => a.textureOwner === 'ahri-e' && !textures.has(a.url))
        .map(async (a) => {
          textures.set(a.url, await cache.load(a, false));
        }),
      ...requiredMeshes
        .filter((a) => a.geometryOwner === 'ahri-e' && !meshes.has(a.url))
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
              throw Error('Ahri E projectile requires one untransformed source mesh');
            const geometry = found[0].geometry,
              color = geometry.getAttribute('color');
            if (!!color !== a.hasVertexColors || (color && color.itemSize !== 4))
              throw Error('Invalid Ahri E source RGBA presence');
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
