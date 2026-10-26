import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { AuthoredMipTextureCache } from '../src/render/authored-mip-texture-cache';
import type { AuthoredMipAsset } from '../src/render/authored-mip-texture';
import data from '../src/content/masteryi-w-buff-particles.json';
const asset = data.textures[0];
function resource() {
  return { texture: new THREE.Texture<ImageBitmap>(), dispose: vi.fn() };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('concurrent consumers share one pending request and retain one successful texture', async () => {
  const pending = deferred<ReturnType<typeof resource>>(),
    load = vi.fn(() => pending.promise),
    cache = new AuthoredMipTextureCache(load),
    r = resource();
  const first = cache.load(asset, false),
    second = cache.load(structuredClone(asset), false);
  expect(second).toBe(first);
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  pending.resolve(r);
  expect(await first).toBe(r.texture);
  expect(await second).toBe(r.texture);
  expect(await cache.load(asset, false)).toBe(r.texture);
  expect(load).toHaveBeenCalledTimes(1);
  cache.dispose();
  cache.dispose();
  expect(r.dispose).toHaveBeenCalledTimes(1);
});
test('shared failure permits an explicit coalesced retry while preserving unrelated successes', async () => {
  const pending = deferred<ReturnType<typeof resource>>(),
    good = resource(),
    retried = resource();
  const load = vi.fn((item: AuthoredMipAsset) =>
    item.url === asset.url ? pending.promise : Promise.resolve(good)
  );
  const cache = new AuthoredMipTextureCache(load);
  const first = cache.load(asset, false),
    second = cache.load(asset, false),
    settled = Promise.allSettled([first, second]);
  const other = { ...asset, url: 'assets/other.png' };
  expect(await cache.load(other, false)).toBe(good.texture);
  pending.reject(Error('503'));
  expect((await settled).map((r) => r.status)).toEqual(['rejected', 'rejected']);
  load.mockImplementation((item) => Promise.resolve(item.url === asset.url ? retried : good));
  expect(await cache.load(other, false)).toBe(good.texture);
  expect(load).toHaveBeenCalledTimes(2);
  const retry = cache.load(asset, false);
  expect(cache.load(asset, false)).toBe(retry);
  expect(await retry).toBe(retried.texture);
  expect(load).toHaveBeenCalledTimes(3);
  cache.dispose();
  expect(good.dispose).toHaveBeenCalledTimes(1);
  expect(retried.dispose).toHaveBeenCalledTimes(1);
});
test.each(['sha256', 'bytes', 'width', 'height', 'rectangles', 'sampler'] as const)(
  'conflicting %s declaration cannot alias a verified resource',
  async (key) => {
    const r = resource(),
      load = vi.fn(async () => r),
      cache = new AuthoredMipTextureCache(load);
    await cache.load(asset, false);
    const changed = structuredClone(asset);
    if (key === 'sha256') changed.sha256 = '0'.repeat(64);
    else if (key === 'rectangles') changed.rectangles[0].width++;
    else if (key !== 'sampler') changed[key]++;
    await expect(cache.load(changed, key === 'sampler')).rejects.toThrow('Conflicting');
    expect(load).toHaveBeenCalledTimes(1);
    expect(r.dispose).not.toHaveBeenCalled();
    cache.dispose();
  }
);
test('disposing while a request is pending releases its eventual bitmaps without returning a dead texture', async () => {
  const pending = deferred<ReturnType<typeof resource>>(),
    cache = new AuthoredMipTextureCache(() => pending.promise),
    r = resource();
  const loading = cache.load(asset, false);
  cache.dispose();
  pending.resolve(r);
  await expect(loading).rejects.toThrow('disposed during load');
  expect(r.dispose).toHaveBeenCalledTimes(1);
  await expect(cache.load(asset, false)).rejects.toThrow('cache is disposed');
  cache.dispose();
  expect(r.dispose).toHaveBeenCalledTimes(1);
});
