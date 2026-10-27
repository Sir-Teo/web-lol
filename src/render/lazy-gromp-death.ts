import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import type { GrompDeath } from './gromp-death';

/** Keep legacy profiles/materials and textures out of ordinary lane entry. */
export class LazyGrompDeath {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: GrompDeath;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private empty = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(private scene: THREE.Scene) {}
  get models() {
    return this.renderer?.models ?? this.empty;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      const module = await import('./gromp-death');
      await module.loadGrompDeath();
      this.renderer = new module.GrompDeath(this.scene);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    models: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    if (this.renderer) this.renderer.update(world, alpha, camera, models, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.kind === 'monster' && u.monster.species === 'gromp')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
}
