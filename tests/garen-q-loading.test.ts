import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

test('partial Q loading disposes completed resources and shares a cached successful retry', async () => {
  let meshes = 0,
    images = 0,
    disposedMeshes = 0,
    disposedImages = 0;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    meshes++;
    const geometry = new THREE.BoxGeometry();
    geometry.addEventListener('dispose', () => disposedMeshes++);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    return { scene } as any;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    if (++images === 2) throw new Error('injected Q lookup failure');
    const texture = new THREE.Texture();
    texture.addEventListener('dispose', () => disposedImages++);
    return texture as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGarenDecisiveStrike: load } = await import('../src/render/garen-decisive-strike');
    const a = load(),
      b = load();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('injected Q lookup failure');
    expect([meshes, images, disposedMeshes, disposedImages]).toEqual([3, 15, 3, 14]);
    await Promise.all([load(), load()]);
    await load();
    expect([meshes, images, disposedMeshes, disposedImages]).toEqual([6, 30, 3, 14]);
  } finally {
    vi.restoreAllMocks();
  }
});
