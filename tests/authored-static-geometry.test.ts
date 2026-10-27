import { test, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as bytes from '../src/render/authored-mip-texture';
import {
  AuthoredStaticGeometryCache,
  loadAuthoredStaticGeometry,
} from '../src/render/authored-static-geometry';
const asset = { url: 'assets/mesh.glb', bytes: 4, sha256: 'a'.repeat(64) };
afterEach(() => vi.restoreAllMocks());
test('two concurrent programs borrow one verified geometry and pending promise', async () => {
  let resolve!: (g: THREE.BufferGeometry) => void;
  const loader = vi.fn(() => new Promise<THREE.BufferGeometry>((r) => (resolve = r))),
    cache = new AuthoredStaticGeometryCache(loader),
    a = cache.load(asset),
    b = cache.load({ ...asset });
  expect(a).toBe(b);
  await Promise.resolve();
  const g = new THREE.BufferGeometry();
  resolve(g);
  expect(await a).toBe(g);
  expect(await b).toBe(g);
  expect(await cache.load(asset)).toBe(g);
  expect(loader).toHaveBeenCalledTimes(1);
});
test.each(['bytes', 'sha256'] as const)(
  'conflicting %s rejects without replacing the successful borrower',
  async (field) => {
    const g = new THREE.BufferGeometry(),
      loader = vi.fn(async () => g),
      cache = new AuthoredStaticGeometryCache(loader);
    await cache.load(asset);
    await expect(
      cache.load({ ...asset, [field]: field === 'bytes' ? 5 : 'b'.repeat(64) })
    ).rejects.toThrow('Conflicting');
    expect(await cache.load(asset)).toBe(g);
    expect(loader).toHaveBeenCalledTimes(1);
  }
);
test('one failed resource is retried without discarding unrelated verified geometry', async () => {
  const good = new THREE.BufferGeometry(),
    retry = new THREE.BufferGeometry(),
    loader = vi
      .fn()
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(Error('missing'))
      .mockResolvedValueOnce(retry),
    cache = new AuthoredStaticGeometryCache(loader);
  await cache.load(asset);
  const other = { ...asset, url: 'assets/other.glb' };
  await expect(cache.load(other)).rejects.toThrow('missing');
  expect(await cache.load(asset)).toBe(good);
  expect(await cache.load(other)).toBe(retry);
  expect(loader).toHaveBeenCalledTimes(3);
});
test('the page owner disposes once and denies subsequent borrowing', async () => {
  const g = new THREE.BufferGeometry(),
    dispose = vi.spyOn(g, 'dispose'),
    cache = new AuthoredStaticGeometryCache(async () => g);
  await cache.load(asset);
  cache.dispose();
  cache.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  await expect(cache.load(asset)).rejects.toThrow('disposed');
});
test('closing during a pending load cleans its eventual resource and rejects the borrower', async () => {
  let resolve!: (g: THREE.BufferGeometry) => void;
  const cache = new AuthoredStaticGeometryCache(() => new Promise((r) => (resolve = r))),
    promise = cache.load(asset);
  await Promise.resolve();
  cache.dispose();
  const g = new THREE.BufferGeometry(),
    dispose = vi.spyOn(g, 'dispose');
  resolve(g);
  await expect(promise).rejects.toThrow('disposed during');
  expect(dispose).toHaveBeenCalledTimes(1);
});
function parsed(scene: THREE.Scene) {
  vi.spyOn(bytes, 'checkedAssetBytes').mockResolvedValue(new ArrayBuffer(4));
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({ scene } as never);
}
test('valid static closure keeps geometry and releases imported materials', async () => {
  const scene = new THREE.Scene(),
    g = new THREE.BufferGeometry(),
    m = new THREE.MeshBasicMaterial(),
    dispose = vi.spyOn(m, 'dispose'),
    gd = vi.spyOn(g, 'dispose');
  scene.add(new THREE.Mesh(g, m));
  parsed(scene);
  expect(await loadAuthoredStaticGeometry(asset)).toBe(g);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(gd).not.toHaveBeenCalled();
  expect(bytes.checkedAssetBytes).toHaveBeenCalledWith(asset.url, asset.bytes, asset.sha256);
});
test.each(['empty', 'multiple', 'transformed', 'skinned'] as const)(
  'rejects %s static mesh closure and releases every unique imported resource',
  async (kind) => {
    const scene = new THREE.Scene(),
      g = new THREE.BufferGeometry(),
      m = new THREE.MeshBasicMaterial(),
      gd = vi.spyOn(g, 'dispose'),
      md = vi.spyOn(m, 'dispose');
    if (kind !== 'empty') {
      const mesh = kind === 'skinned' ? new THREE.SkinnedMesh(g, m) : new THREE.Mesh(g, m);
      if (kind === 'transformed') mesh.position.x = 1;
      scene.add(mesh);
      if (kind === 'multiple') scene.add(new THREE.Mesh(g, m));
    }
    parsed(scene);
    await expect(loadAuthoredStaticGeometry(asset)).rejects.toThrow('closure/transform');
    expect(gd).toHaveBeenCalledTimes(kind === 'empty' ? 0 : 1);
    expect(md).toHaveBeenCalledTimes(kind === 'empty' ? 0 : 1);
  }
);
