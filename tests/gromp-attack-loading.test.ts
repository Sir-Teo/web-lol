import { expect, test, vi } from 'vitest';
import * as THREE from 'three';

test('Gromp missile load shares requests, disposes partial textures and permits a cached retry', async () => {
  let loads = 0,
    disposed = 0;
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    loads++;
    if (loads === 2) throw new Error('injected missile failure');
    const t = new THREE.Texture();
    t.addEventListener('dispose', () => disposed++);
    return t as THREE.Texture<HTMLImageElement>;
  });
  try {
    const { loadGrompAttack } = await import('../src/render/gromp-attack');
    const a = loadGrompAttack(),
      b = loadGrompAttack();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow('injected missile failure');
    expect(loads).toBe(3);
    expect(disposed).toBe(2);
    await Promise.all([loadGrompAttack(), loadGrompAttack()]);
    await loadGrompAttack();
    expect(loads).toBe(6);
    expect(disposed).toBe(2);
  } finally {
    vi.restoreAllMocks();
  }
});
