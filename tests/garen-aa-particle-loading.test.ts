import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import source from '../src/content/garen-aa-particles.json';

test('a failed AA load drains and disposes partial resources; explicit retry is shared and successful assets stay cached', async () => {
  let images = 0,
    meshes = 0,
    disposedImages = 0,
    disposedMeshes = 0;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    meshes++;
    const geometry = new THREE.BoxGeometry(),
      scene = new THREE.Group();
    geometry.addEventListener('dispose', () => disposedMeshes++);
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    return { scene } as any;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    if (++images === 2) throw Error('injected AA texture failure');
    const t = new THREE.Texture();
    t.addEventListener('dispose', () => disposedImages++);
    return t as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGarenBasicAttacks: load } = await import('../src/render/garen-basic-attacks');
    const a = load();
    expect(load()).toBe(a);
    await expect(a).rejects.toThrow('injected AA texture failure');
    const selected = source.profiles.filter((p) => !p.deferred),
      expectedImages = new Set(
        selected.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])])
      ).size;
    const expectedMeshes = new Set(selected.flatMap((p) => (p.mesh ? [p.mesh] : []))).size;
    expect([images, meshes, disposedImages, disposedMeshes]).toEqual([
      expectedImages,
      expectedMeshes,
      expectedImages - 1,
      expectedMeshes,
    ]);
    await Promise.all([load(), load()]);
    await load();
    expect([images, meshes, disposedImages, disposedMeshes]).toEqual([
      expectedImages * 2,
      expectedMeshes * 2,
      expectedImages - 1,
      expectedMeshes,
    ]);
  } finally {
    vi.restoreAllMocks();
  }
});
