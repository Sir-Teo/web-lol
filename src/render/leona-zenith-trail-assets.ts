import * as THREE from 'three';
import { ZENITH_PROFILES } from './leona-zenith-particles';
import { loadLuxParticleTextures } from './lux-particle-textures';

export interface ZenithTrailAssets {
  texture(path: string, address?: number): THREE.Texture;
}
let assets: ZenithTrailAssets | undefined, pending: Promise<void> | undefined;
export function zenithTrailAssets() {
  return assets;
}
export function loadLeonaZenithTrails(): Promise<void> {
  return (pending ??= (async () => {
    const profiles = ZENITH_PROFILES.filter((p) => p.kind === 'trail');
    const source = await loadLuxParticleTextures(
      profiles.flatMap((p) => [p.texture, p.lookup ?? '', p.palette?.texture ?? '']).filter(Boolean)
    );
    const samplers = new Map<string, THREE.Texture>();
    assets = {
      texture(path, address = 0) {
        if (![0, 1, 2].includes(address)) throw RangeError('Unsupported Zenith trail address mode');
        const key = path + ':' + address;
        let texture = samplers.get(key);
        if (!texture) {
          const image = source.get(path);
          if (!image) throw Error('Missing Zenith trail image: ' + path);
          texture = image.clone();
          texture.wrapS = texture.wrapT = [
            THREE.RepeatWrapping,
            THREE.MirroredRepeatWrapping,
            THREE.ClampToEdgeWrapping,
          ][address];
          texture.needsUpdate = true;
          samplers.set(key, texture);
        }
        return texture;
      },
    };
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
