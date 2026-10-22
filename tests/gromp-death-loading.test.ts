import { expect, test, vi } from 'vitest';
import * as THREE from 'three';

test('partial Gromp texture failure disposes completed loads, shares one request set and retries cleanly', async () => {
  let loads = 0,
    disposals = 0;
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
    expect(loads).toBe(4);
    expect(disposals).toBe(3);
    await Promise.all([loadGrompDeath(), loadGrompDeath()]);
    await loadGrompDeath();
    expect(loads).toBe(8);
    expect(disposals).toBe(3);
  } finally {
    vi.restoreAllMocks();
  }
});
