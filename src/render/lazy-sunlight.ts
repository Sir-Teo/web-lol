import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import type { Vec2 } from '../simulation/math';
import type { Sunlight } from './sunlight';

export class LazySunlight {
  private renderer?: Sunlight;
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
      const module = await import('./sunlight');
      await module.loadSunlight();
      this.renderer = new module.Sunlight(this.scene, this.ground);
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
      (world.sunlightVisuals.length || world.units.some((u) => u.champion === 'leona'))
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
}
