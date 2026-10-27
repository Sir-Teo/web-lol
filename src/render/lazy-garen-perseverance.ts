import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { GarenPerseverance } from './garen-perseverance';

/** Keep Garen-only profiles/materials out of ordinary Ashe/Lux entry loading. */
export class LazyGarenPerseverance {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: GarenPerseverance;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private empty = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models ?? this.empty;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      const module = await import('./garen-perseverance');
      await module.loadGarenPerseverance();
      this.renderer = new module.GarenPerseverance(this.scene, this.ground);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, terminalAge = 0) {
    if (this.renderer) this.renderer.update(world, alpha, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.champion === 'garen')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
}
