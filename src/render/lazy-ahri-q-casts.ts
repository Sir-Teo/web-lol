import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { AhriQCasts } from './ahri-q-casts';
/** Ahri source particles are loaded only for a roster containing Ahri. */
export class LazyAhriQCasts {
  onReady?: () => void;
  private renderer?: AhriQCasts;
  private pending?: Promise<void>;
  private attempted = false;
  private closed = false;
  get models() {
    return this.renderer?.models;
  }
  get surfaces() {
    return this.renderer?.surfaces;
  }
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  load(): Promise<void> {
    if (this.closed) return Promise.reject(Error('Ahri Q renderer disposed'));
    if (this.renderer) return Promise.resolve();
    this.attempted = true;
    return (this.pending ??= (async () => {
      const module = await import('./ahri-q-casts');
      await module.loadAhriQCasts();
      if (this.closed) return;
      this.renderer = new module.AhriQCasts(this.scene, this.ground);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.closed) return;
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (!this.attempted && world.units.some((u) => u.champion === 'ahri'))
      void this.load().catch(() => {
        /* Explicit retry; no frame-driven retry loop. */
      });
  }
  dispose() {
    this.closed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
  }
}
