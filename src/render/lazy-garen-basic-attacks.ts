import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { GarenBasicAttacks } from './garen-basic-attacks';

/** Keep the source particle pack out of ordinary Ashe/Lux startup. */
export class LazyGarenBasicAttacks {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: GarenBasicAttacks;
  private pending?: Promise<void>;
  private attempted = false;
  private empty = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models ?? this.empty;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      const module = await import('./garen-basic-attacks');
      await module.loadGarenBasicAttacks();
      this.renderer = new module.GarenBasicAttacks(this.scene, this.ground);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (!this.attempted && world.units.some((u) => u.champion === 'garen')) {
      this.attempted = true;
      void this.load().catch(() => {
        /* Explicit load retries; no per-frame network loop. */
      });
    }
  }
}
