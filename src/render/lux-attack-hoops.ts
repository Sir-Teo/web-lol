import * as THREE from 'three';
import type { LuxAttackVisual } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';
import { luxAttackFrame } from './lux-attack-frame';
import { luxHoopParticles, type LuxHoopParticle } from './lux-hoop-particles';
import { LuxHoopCloud } from './lux-hoop-cloud';

let textures: [THREE.Texture, THREE.Texture] | undefined;
export async function loadLuxAttackTextures() {
  textures = (await Promise.all(
    ['lux_base_r_mote', 'color-spectralbell'].map(async (name) => {
      const texture = await new THREE.TextureLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/effects/lux-ba-${name}.png`
      );
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      return texture;
    })
  )) as [THREE.Texture, THREE.Texture];
}

/** Birth-frame attachment: later missile turns never drag previously born motes.
 * Positions remain in source units here. Height and visibility belong to the view.
 */
export function luxAttackHoopParticles(effect: LuxAttackVisual, tick: number): LuxHoopParticle[] {
  const particles = luxHoopParticles(
    effect.id,
    (tick - effect.launchTick) / 60,
    effect.stopTick === null ? 10 : (effect.stopTick - effect.launchTick) / 60
  );
  return particles.flatMap((particle) => {
    const frame = luxAttackFrame(effect, effect.launchTick + particle.birthTick);
    if (!frame) return [];
    const [x, y, z] = particle.position;
    const c = Math.cos(frame.facing),
      s = Math.sin(frame.facing);
    return [
      { ...particle, position: [frame.x + c * x + s * z, y, frame.y - s * x + c * z] as const },
    ];
  });
}

export class LuxAttackHoops {
  readonly clouds = new Map<number, LuxHoopCloud>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera) {
    if (!textures) return;
    const active = new Set<number>();
    for (const effect of world.luxAttackVisuals) {
      active.add(effect.id);
      let cloud = this.clouds.get(effect.id);
      if (!cloud) {
        cloud = new LuxHoopCloud(...textures);
        this.clouds.set(effect.id, cloud);
        this.scene.add(cloud.mesh);
      }
      const particles = luxAttackHoopParticles(effect, world.tick - 1 + alpha)
        .filter(
          (p) =>
            effect.team === 'blue' || world.pointVisible({ x: p.position[0], y: p.position[2] })
        )
        .map((p) => ({
          ...p,
          position: [
            p.position[0],
            p.position[1] + 100 * (this.ground({ x: p.position[0], y: p.position[2] }) + 0.9),
            p.position[2],
          ] as const,
        }));
      cloud.draw(particles, camera);
    }
    for (const [id, cloud] of this.clouds) {
      if (active.has(id)) continue;
      this.scene.remove(cloud.mesh);
      cloud.dispose();
      this.clouds.delete(id);
    }
  }
}
