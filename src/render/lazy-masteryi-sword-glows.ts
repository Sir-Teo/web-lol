import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { UnitModel } from './models';
import type { SwordGlows } from './masteryi-sword-glows';

/** The private Yi pack stays out of ordinary Ashe/Lux startup. */
export class LazySwordGlows {
  private renderer?: SwordGlows;
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
  get batches() {
    return this.renderer?.instances.batches;
  }
  load(): Promise<void> {
    this.attempted = true;
    return (this.pending ??= (async () => {
      const module = await import('./masteryi-sword-glows');
      await module.loadSwordGlows();
      this.renderer = new module.SwordGlows(this.scene, this.ground);
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  prepare(camera: THREE.Camera) {
    this.renderer?.prepare(camera);
  }
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    models: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ): void {
    if (this.renderer) this.renderer.updateAttached(world, alpha, camera, models, terminalAge);
    else if (!this.attempted && world.units.some((unit) => unit.champion === 'masteryi'))
      void this.load().catch(() => {
        /* Explicit load retries; no per-frame network loop. */
      });
  }
}
