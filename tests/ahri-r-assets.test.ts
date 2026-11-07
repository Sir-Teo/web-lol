import { beforeEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import data from '../src/content/ahri-r-particles.json';
import type { EclipseSurfaceAssets } from '../src/render/leona-eclipse-surface-assets';
const state = vi.hoisted(() => ({
  requests: [] as string[],
  lookups: [] as { url: string; lookup: boolean }[],
  fail: '',
  failed: false,
  ownerLoads: 0,
  w: undefined as EclipseSurfaceAssets | undefined,
  qCast: undefined as EclipseSurfaceAssets | undefined,
  qProjectile: undefined as EclipseSurfaceAssets | undefined,
  borrowed: [] as { owner: string; path: string; address: number }[],
}));
vi.mock('../src/render/authored-mip-texture-cache', () => ({
  AuthoredMipTextureCache: class {
    async load(asset: { url: string }, lookup: boolean) {
      state.requests.push(asset.url);
      state.lookups.push({ url: asset.url, lookup });
      if (asset.url === state.fail && !state.failed) {
        state.failed = true;
        throw Error('controlled texture failure');
      }
      const texture = new THREE.Texture();
      texture.name = asset.url;
      return texture;
    }
  },
}));
vi.mock('../src/render/ahri-w-assets', () => ({
  ahriWAssets: () => state.w,
  loadAhriWAssets: async () => {
    state.ownerLoads++;
  },
}));
vi.mock('../src/render/ahri-q-cast-assets', () => ({ ahriQCastAssets: () => state.qCast }));
vi.mock('../src/render/ahri-q-projectile-assets', () => ({
  ahriQProjectileAssets: () => state.qProjectile,
}));
beforeEach(() => {
  vi.resetModules();
  state.requests = [];
  state.lookups = [];
  state.borrowed = [];
  state.fail = '';
  state.failed = false;
  state.ownerLoads = 0;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([1, 2, 3], 3));
  const provider = (owner: string): EclipseSurfaceAssets => ({
    texture(path, address = 0) {
      state.borrowed.push({ owner, path, address });
      const texture = new THREE.Texture();
      texture.name = owner;
      return texture;
    },
    mesh: () => geometry,
  });
  state.w = provider('w');
  state.qCast = provider('q-cast');
  state.qProjectile = provider('q-projectile');
});
test('R loads exactly eight R textures plus the W transport outside its joined subset', async () => {
  const module = await import('../src/render/ahri-r-assets');
  expect(module.ahriRAssets()).toBeUndefined();
  const first = module.loadAhriRAssets();
  expect(module.loadAhriRAssets()).toBe(first);
  await first;
  const assets = module.ahriRAssets()!;
  expect(state.requests).toHaveLength(9);
  expect(new Set(state.requests).size).toBe(9);
  expect(state.requests.filter((path) => path.startsWith('assets/effects/ahri-r-'))).toHaveLength(
    8
  );
  const extra = 'assets/effects/ahri-w-b7cf3aaa74075f2a.png';
  expect(state.requests).toContain(extra);
  expect(state.lookups.filter((row) => row.lookup)).toEqual([
    { url: 'assets/effects/ahri-r-c9eea0dcd2a24e6e.png', lookup: true },
  ]);
  const repeat = assets.texture(extra, 0),
    clamp = assets.texture(extra, 2);
  expect(assets.texture(extra, 0)).toBe(repeat);
  expect(repeat.wrapS).toBe(THREE.RepeatWrapping);
  expect(clamp.wrapS).toBe(THREE.ClampToEdgeWrapping);
  expect(state.borrowed).toEqual([]);
  await module.loadAhriRAssets();
  expect(state.requests).toHaveLength(9);
  expect(state.ownerLoads).toBe(1);
});
test('R borrows existing Q/W samplers and the already scaled shared mesh without mutating them', async () => {
  const module = await import('../src/render/ahri-r-assets');
  await module.loadAhriRAssets();
  const assets = module.ahriRAssets()!;
  for (const [path, owner] of [
    ['assets/effects/ahri-q-cast-c68cda0f7d1484a0.png', 'q-cast'],
    ['assets/effects/ahri-q-projectile-43a2520d6e62b7b7.png', 'q-projectile'],
    ['assets/effects/ahri-w-ac5e1ebe8b387340.png', 'w'],
  ])
    expect(assets.texture(path, 1).name).toBe(owner);
  // A published but deferred profile cannot expand this loader's closure.
  expect(() => assets.texture('assets/effects/ahri-q-projectile-104eb5bb1d37e53f.png')).toThrow();
  expect(state.borrowed.map((row) => row.address)).toEqual([1, 1, 1]);
  const mesh = data.meshes.find((row) => row.geometryOwner === 'ahri-w')!;
  const original = state.w!.mesh(mesh.url);
  expect(assets.mesh(mesh.url)).toBe(original);
  expect(Array.from(original.getAttribute('position').array)).toEqual([1, 2, 3]);
  expect(() => assets.mesh('assets/effects/unknown.glb')).toThrow();
  expect(() => assets.texture('assets/effects/unknown.png')).toThrow();
  expect(() => assets.texture(state.requests[0], 7)).toThrow();
});
test('R exposes no partial readiness and retries only the failed local texture', async () => {
  state.fail = 'assets/effects/ahri-w-b7cf3aaa74075f2a.png';
  const module = await import('../src/render/ahri-r-assets');
  await expect(module.loadAhriRAssets()).rejects.toThrow('controlled texture failure');
  expect(module.ahriRAssets()).toBeUndefined();
  expect(state.requests).toHaveLength(9);
  await module.loadAhriRAssets();
  expect(module.ahriRAssets()).toBeDefined();
  expect(state.requests).toHaveLength(10);
  expect(state.requests.filter((path) => path === state.fail)).toHaveLength(2);
  for (const path of new Set(state.requests.filter((path) => path !== state.fail)))
    expect(state.requests.filter((value) => value === path)).toHaveLength(1);
});
