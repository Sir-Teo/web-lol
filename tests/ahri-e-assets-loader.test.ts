import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../src/content/ahri-e-particles.json';

const calls = vi.hoisted(() => ({
  textures: vi.fn(),
  bytes: vi.fn(),
  load: vi.fn(),
  cast: vi.fn(),
  projectile: vi.fn(),
  w: vi.fn(),
}));
vi.mock('../src/render/ahri-q-cast-assets', () => ({
  ahriQCastAssets: () => ({ texture: calls.cast }),
}));
vi.mock('../src/render/ahri-q-projectile-assets', () => ({
  ahriQProjectileAssets: () => ({ texture: calls.projectile }),
}));
vi.mock('../src/render/ahri-w-assets', () => ({
  loadAhriWAssets: () => calls.load(),
  ahriWAssets: () => ({ texture: calls.w }),
}));
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
import { ahriEAssets, loadAhriEAssets } from '../src/render/ahri-e-assets';

test('E retries only failed transports, preserves missing colors and borrows all Q/W textures', async () => {
  const borrowed = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
  calls.cast.mockReturnValue(borrowed[0]);
  calls.projectile.mockReturnValue(borrowed[1]);
  calls.w.mockReturnValue(borrowed[2]);
  calls.load.mockResolvedValue(undefined);
  calls.textures.mockImplementation(async () => new THREE.Texture());
  let failed = false;
  calls.bytes.mockImplementation(async (url: string, bytes: number, hash: string) => {
    if (!failed) {
      failed = true;
      throw Error('network');
    }
    const raw = readFileSync('public/' + url);
    expect(raw.byteLength).toBe(bytes);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(hash);
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  });
  expect(ahriEAssets()).toBeUndefined();
  await expect(loadAhriEAssets()).rejects.toThrow('network');
  expect(ahriEAssets()).toBeUndefined();
  expect(calls.textures).toHaveBeenCalledTimes(11);
  expect(calls.bytes).toHaveBeenCalledTimes(2);
  const first = loadAhriEAssets(),
    second = loadAhriEAssets();
  expect(first).toBe(second);
  await first;
  await loadAhriEAssets();
  expect(calls.textures).toHaveBeenCalledTimes(11);
  expect(calls.bytes).toHaveBeenCalledTimes(3);
  expect(calls.load).toHaveBeenCalledTimes(2);
  const assets = ahriEAssets()!;
  for (const row of data.meshes) {
    const geometry = assets.mesh(row.url);
    const raw = readFileSync('public/' + row.url);
    const reference = await new GLTFLoader().parseAsync(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      ''
    );
    let original!: THREE.BufferGeometry;
    reference.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) original = node.geometry;
    });
    const position = geometry.getAttribute('position'),
      source = original.getAttribute('position');
    for (let i = 0; i < source.count; i++)
      for (const channel of ['getX', 'getY', 'getZ'] as const)
        expect(position[channel](i)).toBe(Math.fround(source[channel](i) * 0.01) || 0);
    expect(geometry.getAttribute('position').count).toBe(row.vertices);
    expect(geometry.index!.count).toBe(row.triangles * 3);
    expect(!!geometry.getAttribute('color')).toBe(row.hasVertexColors);
    expect(!!geometry.getAttribute('_source_vertex_bgra')).toBe(row.hasVertexColors);
    expect(geometry.getAttribute('normal')).toBeUndefined();
    if (row.hasVertexColors) {
      const color = geometry.getAttribute('color'),
        bgra = geometry.getAttribute('_source_vertex_bgra');
      expect(bgra.normalized).toBe(true);
      for (let i = 0; i < color.count; i++)
        expect([bgra.getX(i), bgra.getY(i), bgra.getZ(i), bgra.getW(i)]).toEqual([
          color.getZ(i),
          color.getY(i),
          color.getX(i),
          color.getW(i),
        ]);
    }
  }
  for (const row of data.textures) {
    if (row.textureOwner === 'ahri-e') {
      expect(assets.texture(row.url)).toBe(assets.texture(row.url));
      expect(assets.texture(row.url, 1).wrapS).toBe(THREE.MirroredRepeatWrapping);
      expect(assets.texture(row.url, 2).wrapT).toBe(THREE.ClampToEdgeWrapping);
    } else {
      const index = ['ahri-q-cast', 'ahri-q-projectile', 'ahri-w'].indexOf(row.textureOwner);
      expect(assets.texture(row.url, 2)).toBe(borrowed[index]);
      expect([calls.cast, calls.projectile, calls.w][index]).toHaveBeenCalledWith(row.url, 2);
    }
  }
  expect(() => assets.texture('missing')).toThrow('Missing');
  expect(() => assets.mesh('missing')).toThrow('Missing');
  expect(() => assets.texture(data.textures[0].url, 7)).toThrow();
});
