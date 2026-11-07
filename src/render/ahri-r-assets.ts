import * as THREE from 'three';
import data from '../content/ahri-r-particles.json';
import { rPaletteBinding } from './ahri-r-palette';
import wData from '../content/ahri-w-particles.json';
import { AHRI_R_BOUND_SPELL_PROFILES, AHRI_R_BOUND_BUFF_PROFILES } from './ahri-r-particles';
import { ahriQCastAssets } from './ahri-q-cast-assets';
import { ahriQProjectileAssets } from './ahri-q-projectile-assets';
import { ahriWAssets, loadAhriWAssets } from './ahri-w-assets';
import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

function collect(value: unknown, into: Set<string>): void {
  if (typeof value === 'string' && value.startsWith('assets/effects/')) into.add(value);
  else if (Array.isArray(value)) value.forEach((child) => collect(child, into));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((child) => collect(child, into));
}
const needed = new Set<string>(),
  wNeeded = new Set<string>();
for (const index of [...AHRI_R_BOUND_SPELL_PROFILES, ...AHRI_R_BOUND_BUFF_PROFILES])
  collect(data.profiles[index], needed);
for (const profile of wData.profiles)
  if (['orbit', 'flight', 'hit'].includes(profile.role)) collect(profile, wNeeded);
const requiredTextures = data.textures.filter((asset) => needed.has(asset.url));
const requiredMeshes = data.meshes.filter((asset) => needed.has(asset.url));
const paletteTextures = new Set(
  AHRI_R_BOUND_SPELL_PROFILES.map((index) => rPaletteBinding(data.profiles[index])?.texture).filter(
    (path) => path !== undefined
  )
);
const localTextures = requiredTextures.filter(
  (asset) =>
    asset.textureOwner === 'ahri-r' || (asset.textureOwner === 'ahri-w' && !wNeeded.has(asset.url))
);
if (
  AHRI_R_BOUND_SPELL_PROFILES.length !== 21 ||
  requiredTextures.length !== 32 ||
  requiredMeshes.length !== 1 ||
  requiredMeshes[0].geometryOwner !== 'ahri-w' ||
  localTextures.length !== 12
)
  throw Error('R spell asset closure differs');

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const cache = new AuthoredMipTextureCache();
const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined,
  ready = false;
export function ahriRAssets(): EclipseSurfaceAssets | undefined {
  return ready ? assets : undefined;
}
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (path === '') return white;
    if (![0, 1, 2].includes(address)) throw RangeError('Unsupported Ahri R texture address');
    const source = textures.get(path);
    if (!source) {
      const owner = requiredTextures.find((asset) => asset.url === path)?.textureOwner;
      if (owner === 'ahri-q-cast') return ahriQCastAssets()!.texture(path, address);
      if (owner === 'ahri-q-projectile') return ahriQProjectileAssets()!.texture(path, address);
      if (owner === 'ahri-w' && wNeeded.has(path)) return ahriWAssets()!.texture(path, address);
      throw Error('Missing Ahri R texture: ' + path);
    }
    const key = `${path}:${address}`;
    let result = samplers.get(key);
    if (!result) {
      result = source.clone();
      result.wrapS = result.wrapT = [
        THREE.RepeatWrapping,
        THREE.MirroredRepeatWrapping,
        THREE.ClampToEdgeWrapping,
      ][address];
      result.needsUpdate = true;
      samplers.set(key, result);
    }
    return result;
  },
  mesh(path) {
    if (!requiredMeshes.some((asset) => asset.url === path))
      throw Error('Missing Ahri R mesh: ' + path);
    // W owns the byte-identical geometry and has already converted it once.
    return ahriWAssets()!.mesh(path);
  },
};
/** Page-owned R views borrow verified Q/W resources. One W transport lies outside
 * W's joined closure, so R loads that exact URL alongside its eleven new textures; the gradient uses the lookup filter.
 * Successes survive retries; partial readiness is never exposed. */
export function loadAhriRAssets(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      loadAhriWAssets(),
      ...localTextures
        .filter((asset) => !textures.has(asset.url))
        .map(async (asset) => {
          textures.set(asset.url, await cache.load(asset, paletteTextures.has(asset.url)));
        }),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
