import * as THREE from 'three';
import { SOLAR_PROFILES } from './leona-solar-particles';
import { loadLuxParticleTextures } from './lux-particle-textures';
export interface SolarProjectionAssets {
  texture(path: string, address: number): THREE.Texture;
}
let assets: SolarProjectionAssets | undefined, pending: Promise<void> | undefined;
export function solarProjectionAssets() {
  return assets;
}
export function loadLeonaSolarProjections() {
  return (pending ??= (async () => {
    const profiles = SOLAR_PROFILES.filter((p) => p.kind === 'projection'),
      images = await loadLuxParticleTextures(profiles.flatMap((p) => [p.texture!, p.lookup!])),
      samplers = new Map<string, THREE.Texture>();
    assets = {
      texture(path, address) {
        if (!Number.isInteger(address) || address < 0 || address > 2)
          throw RangeError('Invalid Solar projection address mode');
        const key = `${path}:${address}`;
        let texture = samplers.get(key);
        if (!texture) {
          const image = images.get(path);
          if (!image) throw Error('Missing Solar projection image: ' + path);
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
