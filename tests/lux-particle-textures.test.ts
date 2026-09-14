import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { loadLuxParticleTextures } from '../src/render/lux-particle-textures';

test('concurrent borrowers share one load, one texture and one white fallback', async () => {
  const spy = vi
    .spyOn(THREE.TextureLoader.prototype, 'loadAsync')
    .mockImplementation(async () => new THREE.Texture());
  try {
    const [a, b] = await Promise.all([
      loadLuxParticleTextures(['a.png', 'a.png'], '/shared-test/'),
      loadLuxParticleTextures(['a.png'], '/shared-test/'),
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.get('a.png')).toBe(b.get('a.png'));
    expect(a.get('')).toBe(b.get(''));
    const texture = a.get('a.png')!;
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.flipY).toBe(false);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    a.delete('a.png');
    expect((await loadLuxParticleTextures(['a.png'], '/shared-test/')).get('a.png')).toBe(texture);
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
test('failed loads can retry and distinct base URLs do not share payloads', async () => {
  const spy = vi
    .spyOn(THREE.TextureLoader.prototype, 'loadAsync')
    .mockRejectedValueOnce(new Error('network'))
    .mockImplementation(async () => new THREE.Texture());
  try {
    await expect(loadLuxParticleTextures(['b.png'], '/retry-test/')).rejects.toThrow('network');
    const retry = await loadLuxParticleTextures(['b.png'], '/retry-test/');
    const other = await loadLuxParticleTextures(['b.png'], '/other-test/');
    expect(retry.get('b.png')).not.toBe(other.get('b.png'));
    expect(spy).toHaveBeenCalledTimes(3);
  } finally {
    spy.mockRestore();
  }
});
