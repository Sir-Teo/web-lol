import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

test('partial Courage asset failure disposes completed ownership, shares concurrent loads and permits one cached retry', async () => {
  const geometries: THREE.BufferGeometry[] = [],
    images: THREE.Texture[] = [];
  let meshesLoaded = 0,
    texturesLoaded = 0,
    geometryDisposals = 0,
    imageDisposals = 0;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    meshesLoaded++;
    const geometry = new THREE.BoxGeometry();
    geometries.push(geometry);
    geometry.addEventListener('dispose', () => geometryDisposals++);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    return { scene } as any;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    texturesLoaded++;
    if (texturesLoaded === 5) throw new Error('injected W texture failure');
    const image = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    images.push(image);
    image.addEventListener('dispose', () => imageDisposals++);
    return image as unknown as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGarenCourage } = await import('../src/render/garen-courage');
    const a = loadGarenCourage(),
      b = loadGarenCourage();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('injected W texture failure');
    expect(meshesLoaded).toBe(1);
    expect(texturesLoaded).toBe(14);
    expect(geometryDisposals).toBe(1);
    expect(imageDisposals).toBe(13);
    await Promise.all([loadGarenCourage(), loadGarenCourage()]);
    expect(meshesLoaded).toBe(2);
    expect(texturesLoaded).toBe(28);
    await loadGarenCourage();
    expect(meshesLoaded).toBe(2);
    expect(texturesLoaded).toBe(28);
    expect(geometryDisposals).toBe(1);
    expect(imageDisposals).toBe(13);
  } finally {
    vi.restoreAllMocks();
  }
});
