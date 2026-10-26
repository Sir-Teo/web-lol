import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { MeditateBuffs } from './masteryi-w-buffs';

/** The private Yi pack stays out of ordinary Ashe/Lux startup. */
export class LazyMeditateBuffs {
  private renderer?: MeditateBuffs;
  private pending?: Promise<void>;
  private attempted = false;
  private empty = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models ?? this.empty;
  }
  load(): Promise<void> {
    this.attempted = true;
    return (this.pending ??= (async () => {
      const module = await import('./masteryi-w-buffs');
      await module.loadMeditateBuffs();
      this.renderer = new module.MeditateBuffs(this.scene, this.ground);
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0): void {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (!this.attempted && world.units.some((unit) => unit.champion === 'masteryi'))
      void this.load().catch(() => {
        /* Explicit load retries; no per-frame network loop. */
      });
  }
}
