import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../src/content/ahri-w-particles.json';
const calls = vi.hoisted(() => ({
  textures: vi.fn(),
  bytes: vi.fn(),
  castTexture: vi.fn(),
  projectileLoad: vi.fn(),
  projectileTexture: vi.fn(),
}));
vi.mock('../src/render/ahri-q-cast-assets', () => ({
  ahriQCastAssets: () => ({ texture: calls.castTexture }),
}));
vi.mock('../src/render/ahri-q-projectile-assets', () => ({
  loadAhriQProjectileAssets: () => calls.projectileLoad(),
  ahriQProjectileAssets: () => ({ texture: calls.projectileTexture }),
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
import { ahriWAssets, loadAhriWAssets } from '../src/render/ahri-w-assets';
test('W loads only joined assets, retries failed meshes and borrows Q textures without ownership changes', async () => {
  const borrowedCast = new THREE.Texture(),
    borrowedProjectile = new THREE.Texture();
  const castDispose = vi.spyOn(borrowedCast, 'dispose');
  const projectileDispose = vi.spyOn(borrowedProjectile, 'dispose');
  calls.projectileLoad.mockResolvedValue(undefined);
  calls.castTexture.mockReturnValue(borrowedCast);
  calls.projectileTexture.mockReturnValue(borrowedProjectile);
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
  expect(ahriWAssets()).toBeUndefined();
  await expect(loadAhriWAssets()).rejects.toThrow('network');
  expect(ahriWAssets()).toBeUndefined();
  expect(calls.textures).toHaveBeenCalledTimes(24);
  const a = loadAhriWAssets(),
    b = loadAhriWAssets();
  expect(a).toBe(b);
  await a;
  await loadAhriWAssets();
  expect(calls.textures).toHaveBeenCalledTimes(24);
  expect(calls.bytes).toHaveBeenCalledTimes(2);
  const assets = ahriWAssets()!;
  const flightMesh = data.profiles.find((p) => p.role === 'flight' && p.mesh)!.mesh;
  for (const mesh of data.meshes) {
    if (mesh.url !== flightMesh) {
      expect(() => assets.mesh(mesh.url)).toThrow('Missing');
      continue;
    }
    const geometry = assets.mesh(mesh.url);
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
    expect(assets.texture(texture.url, 2)).toBe(borrowedCast);
    expect(calls.castTexture).toHaveBeenCalledWith(texture.url, 2);
  }
  for (const texture of data.textures.filter((t) => t.textureOwner === 'ahri-q-projectile')) {
    expect(assets.texture(texture.url, 2)).toBe(borrowedProjectile);
    expect(calls.projectileTexture).toHaveBeenCalledWith(texture.url, 2);
  }
  const requested = new Set(calls.textures.mock.calls.map((args) => args[0].url));
  const own = data.textures.find((t) => requested.has(t.url))!.url;
  const unused = data.textures.filter((t) => t.textureOwner === 'ahri-w' && !requested.has(t.url));
  expect(unused).toHaveLength(5);
  for (const texture of unused) expect(() => assets.texture(texture.url)).toThrow('Missing');
  expect(assets.texture(own, 0)).toBe(assets.texture(own, 0));
  expect(assets.texture(own, 1).wrapS).toBe(THREE.MirroredRepeatWrapping);
  expect(assets.texture(own, 2).wrapT).toBe(THREE.ClampToEdgeWrapping);
  expect((assets.texture('', 2).image as { data: Uint8Array }).data).toEqual(
    new Uint8Array([255, 255, 255, 255])
  );
  expect(() => assets.texture(own, 3)).toThrow('address');
  expect(() => assets.texture('missing')).toThrow('Missing');
  expect(() => assets.mesh('missing')).toThrow('Missing');
  expect(castDispose).not.toHaveBeenCalled();
  expect(projectileDispose).not.toHaveBeenCalled();
  expect(calls.projectileLoad).toHaveBeenCalledTimes(2);
});
