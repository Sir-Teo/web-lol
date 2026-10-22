import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

test('full Oracle preparation shares requests, disposes a partial failure and caches a complete retry', async () => {
  let meshLoads = 0,
    textureLoads = 0,
    geometryDisposals = 0,
    textureDisposals = 0;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    meshLoads++;
    const geometry = new THREE.BoxGeometry();
    geometry.addEventListener('dispose', () => geometryDisposals++);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    return { scene, animations: [new THREE.AnimationClip('buff', 2, [])] } as any;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    textureLoads++;
    if (textureLoads === 5) throw new Error('Oracle texture unavailable');
    const image = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    image.addEventListener('dispose', () => textureDisposals++);
    return image as unknown as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadOracleParticles } = await import('../src/render/oracle-particles');
    const a = loadOracleParticles(),
      b = loadOracleParticles();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('Oracle texture unavailable');
    expect([meshLoads, textureLoads, geometryDisposals, textureDisposals]).toEqual([4, 15, 4, 14]);
    await Promise.all([loadOracleParticles(), loadOracleParticles()]);
    expect([meshLoads, textureLoads, geometryDisposals, textureDisposals]).toEqual([8, 30, 4, 14]);
    await loadOracleParticles();
    expect([meshLoads, textureLoads]).toEqual([8, 30]);
  } finally {
    vi.restoreAllMocks();
  }
});
