import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../src/content/ahri-q-projectile-particles.json';
const calls = vi.hoisted(() => ({
  textures: vi.fn(),
  bytes: vi.fn(),
  castLoad: vi.fn(),
  castTexture: vi.fn(),
  castMesh: vi.fn(),
}));
vi.mock('../src/render/ahri-q-cast-assets', () => ({
  loadAhriQCastAssets: () => calls.castLoad(),
  ahriQCastAssets: () => ({ texture: calls.castTexture, mesh: calls.castMesh }),
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
import {
  ahriQProjectileAssets,
  loadAhriQProjectileAssets,
} from '../src/render/ahri-q-projectile-assets';
test('verified owned resources survive retries and shared caster resources remain borrowed without double conversion', async () => {
  const borrowedMesh = new THREE.BoxGeometry(2, 2, 2),
    borrowedTexture = new THREE.Texture();
  const dispose = vi.spyOn(borrowedMesh, 'dispose');
  calls.castLoad.mockResolvedValue(undefined);
  calls.castTexture.mockReturnValue(borrowedTexture);
  calls.castMesh.mockReturnValue(borrowedMesh);
  calls.textures.mockImplementation(async (a: { url: string }) => {
    const t = new THREE.Texture();
    t.name = a.url;
    return t;
  });
  let failed = false;
  const raw = (url: string) => {
    const b = readFileSync('public/' + url);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  calls.bytes.mockImplementation(async (url: string, bytes: number, sha: string) => {
    if (!failed) {
      failed = true;
      throw Error('network');
    }
    const b = readFileSync('public/' + url);
    expect(b.length).toBe(bytes);
    expect(createHash('sha256').update(b).digest('hex')).toBe(sha);
    return raw(url);
  });
  expect(ahriQProjectileAssets()).toBeUndefined();
  await expect(loadAhriQProjectileAssets()).rejects.toThrow('network');
  expect(ahriQProjectileAssets()).toBeUndefined();
  expect(calls.textures).toHaveBeenCalledTimes(15);
  const a = loadAhriQProjectileAssets(),
    b = loadAhriQProjectileAssets();
  expect(a).toBe(b);
  await a;
  await loadAhriQProjectileAssets();
  expect(calls.textures).toHaveBeenCalledTimes(15);
  expect(calls.bytes).toHaveBeenCalledTimes(3);
  const assets = ahriQProjectileAssets()!;
  for (const mesh of data.meshes) {
    const geometry = assets.mesh(mesh.url);
    if (mesh.geometryOwner === 'ahri-q-cast') {
      expect(geometry).toBe(borrowedMesh);
      expect(geometry.getAttribute('position').getX(0)).toBe(1);
      continue;
    }
    const source = await new GLTFLoader().parseAsync(raw(mesh.url), '');
    let original!: THREE.BufferGeometry;
    source.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) original = node.geometry;
    });
    const positions = geometry.getAttribute('position'),
      old = original.getAttribute('position');
    expect(positions.count).toBe(old.count);
    for (let i = 0; i < old.count; i++)
      for (const channel of ['getX', 'getY', 'getZ'] as const)
        expect(positions[channel](i)).toBe(Math.fround(old[channel](i) * 0.01) || 0);
    const color = geometry.getAttribute('color'),
      bgra = geometry.getAttribute('_source_vertex_bgra');
    if (color) {
      expect(bgra.normalized).toBe(true);
      for (let i = 0; i < color.count; i++)
        expect([bgra.getX(i), bgra.getY(i), bgra.getZ(i), bgra.getW(i)]).toEqual([
          color.getZ(i),
          color.getY(i),
          color.getX(i),
          color.getW(i),
        ]);
    } else expect(bgra).toBeUndefined();
    expect(geometry.getAttribute('normal')).toBeUndefined();
  }
  for (const texture of data.textures.filter((t) => t.textureOwner === 'ahri-q-cast')) {
    expect(assets.texture(texture.url, 2)).toBe(borrowedTexture);
    expect(calls.castTexture).toHaveBeenCalledWith(texture.url, 2);
  }
  const own = data.textures.find((t) => t.textureOwner !== 'ahri-q-cast')!.url;
  expect(assets.texture(own, 0)).toBe(assets.texture(own, 0));
  expect(assets.texture(own, 1).wrapS).toBe(THREE.MirroredRepeatWrapping);
  expect(assets.texture(own, 2).wrapT).toBe(THREE.ClampToEdgeWrapping);
  expect((assets.texture('', 2).image as { data: Uint8Array }).data).toEqual(
    new Uint8Array([255, 255, 255, 255])
  );
  expect(() => assets.texture(own, 3)).toThrow('address');
  expect(() => assets.texture('missing')).toThrow('Missing');
  expect(() => assets.mesh('missing')).toThrow('Missing');
  expect(dispose).not.toHaveBeenCalled();
});
