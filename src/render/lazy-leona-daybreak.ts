import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LeonaDaybreak } from './leona-daybreak';
export class LazyLeonaDaybreak {
  private renderer?: LeonaDaybreak;
  private pending?: Promise<void>;
  private retryAfter = 0;
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
      const m = await import('./leona-daybreak');
      await m.loadLeonaDaybreak();
      this.renderer = new m.LeonaDaybreak(this.scene, this.ground);
    })().catch((e) => {
      this.pending = undefined;
      throw e;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.champion === 'leona')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => (this.retryAfter = performance.now() + 5000));
    }
  }
}
