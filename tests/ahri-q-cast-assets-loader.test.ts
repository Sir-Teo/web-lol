import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import data from '../src/content/ahri-q-cast-particles.json';
const calls = vi.hoisted(() => ({ textures: vi.fn(), bytes: vi.fn() }));
vi.mock('../src/render/authored-mip-texture-cache', () => ({
  AuthoredMipTextureCache: class {
    load(...args: unknown[]) {
      return calls.textures(...args);
    }
  },
}));
vi.mock('../src/render/authored-mip-texture', () => ({
  checkedAssetBytes: (...args: unknown[]) => calls.bytes(...args),
}));
import { ahriQCastAssets, loadAhriQCastAssets } from '../src/render/ahri-q-cast-assets';
test('verified resources survive explicit retries, native centimetres become metres, RGBA becomes exact shader BGRA', async () => {
  calls.textures.mockImplementation(async (a: { url: string }) => {
    const t = new THREE.Texture();
    t.name = a.url;
    return t;
  });
  calls.bytes.mockRejectedValueOnce(Error('network'));
  expect(ahriQCastAssets()).toBeUndefined();
  await expect(loadAhriQCastAssets()).rejects.toThrow('network');
  expect(calls.textures).toHaveBeenCalledTimes(4);
  expect(ahriQCastAssets()).toBeUndefined();
  calls.bytes.mockImplementation(async (url: string, bytes: number, sha: string) => {
    const b = readFileSync('public/' + url);
    expect(b.length).toBe(bytes);
    expect(createHash('sha256').update(b).digest('hex')).toBe(sha);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  });
  const a = loadAhriQCastAssets(),
    b = loadAhriQCastAssets();
  expect(a).toBe(b);
  await a;
  await loadAhriQCastAssets();
  expect(calls.textures).toHaveBeenCalledTimes(4);
  expect(calls.bytes).toHaveBeenCalledTimes(2);
  const assets = ahriQCastAssets()!,
    g = assets.mesh(data.meshes[0].url);
  g.computeBoundingBox();
  expect(g.boundingBox!.min.x).toBeCloseTo(-2.2454489135742188);
  expect(g.boundingBox!.max.y).toBeCloseTo(1.9735269165039062);
  const rgba = g.getAttribute('color'),
    bgra = g.getAttribute('_source_vertex_bgra');
  expect(bgra.count).toBe(603);
  expect(bgra.normalized).toBe(true);
  for (let i = 0; i < rgba.count; i++)
    expect([bgra.getX(i), bgra.getY(i), bgra.getZ(i), bgra.getW(i)]).toEqual([
      rgba.getZ(i),
      rgba.getY(i),
      rgba.getX(i),
      rgba.getW(i),
    ]);
  expect(g.getAttribute('normal')).toBeUndefined();
  const url = data.textures[0].url;
  expect(assets.texture(url, 0)).toBe(assets.texture(url, 0));
  expect(assets.texture(url, 0)).not.toBe(assets.texture(url, 2));
  expect(assets.texture(url, 1).wrapS).toBe(THREE.MirroredRepeatWrapping);
  expect(assets.texture(url, 2).wrapT).toBe(THREE.ClampToEdgeWrapping);
  expect(Array.from((assets.texture('', 2).image as { data: Uint8Array }).data)).toEqual([
    255, 255, 255, 255,
  ]);
  expect(() => assets.texture(url, 3)).toThrow('address');
  expect(() => assets.mesh('missing')).toThrow('Missing');
  expect(() => assets.texture('missing')).toThrow('Missing');
});
