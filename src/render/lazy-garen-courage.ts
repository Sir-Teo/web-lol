import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { GarenCourage } from './garen-courage';
import type { UnitModel } from './models';

/** Keep Garen-only profiles/materials out of ordinary Ashe/Lux entry loading. */
export class LazyGarenCourage {
  private renderer?: GarenCourage;
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
      const module = await import('./garen-courage');
      await module.loadGarenCourage();
      this.renderer = new module.GarenCourage(this.scene, this.ground);
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
      world.units.some((u) => u.champion === 'garen')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
}
