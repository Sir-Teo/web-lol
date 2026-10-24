import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LeonaSolarSkins } from './leona-solar-skins';

export class LazyLeonaSolarSkins {
  private renderer?: LeonaSolarSkins;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private disposed = false;
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models;
  }
  load(): Promise<void> {
    if (this.disposed) return Promise.reject(Error('Solar skins have been disposed'));
    return (this.pending ??= (async () => {
      const m = await import('./leona-solar-skins');
      await m.loadLeonaSolarSkins();
      if (!this.disposed) this.renderer = new m.LeonaSolarSkins(this.scene, this.ground);
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, terminalAge = 0) {
    if (this.disposed) return;
    if (this.renderer) this.renderer.update(world, alpha, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.champion === 'leona')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => (this.retryAfter = performance.now() + 5000));
    }
  }
  dispose() {
    this.disposed = true;
    this.renderer?.dispose();
  }
}
