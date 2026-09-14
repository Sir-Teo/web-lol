import * as THREE from 'three';

// Session-owned source images with identical sampler/color settings. Effects borrow
// these textures and must not mutate their settings or dispose them individually.
const pending = new Map<string, Promise<THREE.Texture>>();
let white: THREE.DataTexture | undefined;
export async function loadLuxParticleTextures(
  paths: Iterable<string>,
  base = import.meta.env.BASE_URL
) {
  const entries = await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const url = base + path;
      let loaded = pending.get(url);
      if (!loaded) {
        loaded = new THREE.TextureLoader()
          .loadAsync(url)
          .then((texture) => {
            texture.colorSpace = THREE.NoColorSpace;
            texture.flipY = false;
            texture.minFilter = texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            return texture;
          })
          .catch((error) => {
            pending.delete(url);
            throw error;
          });
        pending.set(url, loaded);
      }
      return [path, await loaded] as const;
    })
  );
  white ??= new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  if (white.version === 0) white.needsUpdate = true;
  return new Map<string, THREE.Texture>([...entries, ['', white]]);
}
