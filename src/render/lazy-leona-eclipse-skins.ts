import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LeonaEclipseSkins } from './leona-eclipse-skins';

export class LazyLeonaEclipseSkins {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: LeonaEclipseSkins;
  private pending?: Promise<void>;
  private retryAfter = 0;
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      const m = await import('./leona-eclipse-skins');
      await m.loadLeonaEclipseSkins();
      this.renderer = new m.LeonaEclipseSkins(this.scene, this.ground);
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
      world.units.some((u) => u.champion === 'leona')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => (this.retryAfter = performance.now() + 5000));
    }
  }
}
