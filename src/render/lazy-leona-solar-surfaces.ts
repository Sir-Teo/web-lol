import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LeonaSolarSurfaces } from './leona-solar-surfaces';

export class LazyLeonaSolarSurfaces {
  private renderer?: LeonaSolarSurfaces;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private disposed = false;
  constructor(
    private scene: THREE.Scene,
    private distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private early?: THREE.Scene
  ) {}
  get models() {
    return this.renderer?.models;
  }
  load(): Promise<void> {
    if (this.disposed) return Promise.reject(Error('Solar surfaces have been disposed'));
    return (this.pending ??= (async () => {
      const m = await import('./leona-solar-surfaces');
      await m.loadLeonaSolarSurfaces();
      if (!this.disposed)
        this.renderer = new m.LeonaSolarSurfaces(
          this.scene,
          this.distortion,
          this.ground,
          undefined,
          this.early
        );
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.disposed) return;
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.champion === 'leona')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => (this.retryAfter = performance.now() + 5000));
    }
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer?.prepareDepth(renderer, camera);
  }
  dispose() {
    this.disposed = true;
    this.renderer?.dispose();
  }
}
