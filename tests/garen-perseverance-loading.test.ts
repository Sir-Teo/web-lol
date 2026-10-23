import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('a failed source image can retry without redownloading successful images, and effect cleanup borrows textures', async () => {
  let requests = 0,
    textureDisposals = 0;
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    requests++;
    if (requests === 2) throw Error('missing source lookup');
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.addEventListener('dispose', () => textureDisposals++);
    return texture as unknown as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGarenPerseverance, GarenPerseverance } =
      await import('../src/render/garen-perseverance');
    const a = loadGarenPerseverance(),
      b = loadGarenPerseverance();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('missing source lookup');
    await Promise.all([loadGarenPerseverance(), loadGarenPerseverance()]);
    expect(requests).toBe(3);
    const scene = new THREE.Scene(),
      renderer = new GarenPerseverance(scene, () => 0),
      w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
    const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    // Worst-case rapid recovery toggles: one born particle every other tick.
    const state = w.championState(garen.id)!;
    state.garenPassiveVisuals = Array.from({ length: 90 }, (_, i) => ({
      startTick: 2 * i,
      stopTick: 2 * i + 2,
      point: { x: 0, y: 0 },
    }));
    w.tick = 181;
    renderer.update(w, 1);
    const mesh = renderer.models.get(garen.id)!;
    expect(mesh.userData.liveParticles).toBeGreaterThan(30);
    expect(mesh.geometry.drawRange.count).toBe(mesh.userData.liveParticles * 6);
    let disposals = 0;
    mesh.geometry.addEventListener('dispose', () => disposals++);
    mesh.material.addEventListener('dispose', () => disposals++);
    state.garenPassiveVisuals = [];
    renderer.update(w, 1);
    expect(disposals).toBe(2);
    expect(renderer.models.size).toBe(0);
    expect(scene.children).toHaveLength(0);
    expect(textureDisposals).toBe(0);
    await loadGarenPerseverance();
    expect(requests).toBe(3);
  } finally {
    vi.restoreAllMocks();
  }
});
