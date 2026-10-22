import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

test('partial Gromp texture failure disposes completed loads, shares one request set and retries cleanly', async () => {
  let loads = 0,
    disposals = 0,
    meshesLoaded = 0,
    geometryDisposals = 0;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    meshesLoaded++;
    const geometry = new THREE.PlaneGeometry();
    geometry.addEventListener('dispose', () => geometryDisposals++);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    return { scene } as any;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    loads++;
    if (loads === 2) throw new Error('injected Gromp texture failure');
    const texture = new THREE.Texture();
    texture.addEventListener('dispose', () => disposals++);
    return texture as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGrompDeath } = await import('../src/render/gromp-death');
    const a = loadGrompDeath(),
      b = loadGrompDeath();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('injected Gromp texture failure');
    expect(loads).toBe(9);
    expect(disposals).toBe(8);
    expect(meshesLoaded).toBe(1);
    expect(geometryDisposals).toBe(1);
    await Promise.all([loadGrompDeath(), loadGrompDeath()]);
    await loadGrompDeath();
    expect(loads).toBe(18);
    expect(disposals).toBe(8);
    expect(meshesLoaded).toBe(2);
    expect(geometryDisposals).toBe(1);
  } finally {
    vi.restoreAllMocks();
  }
});
