import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { UnitModel } from './models';
import type { PrimaryTrails } from './masteryi-primary-trails';

/** The private Yi pack stays out of ordinary Ashe/Lux startup. */
export class LazyPrimaryTrails {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: PrimaryTrails;
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
  load(): Promise<void> {
    this.attempted = true;
    return (this.pending ??= (async () => {
      const module = await import('./masteryi-primary-trails');
      await module.loadPrimaryTrails();
      this.renderer = new module.PrimaryTrails(this.scene, this.ground);
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
  ): void {
    if (this.renderer) this.renderer.updateAttached(world, alpha, camera, models, terminalAge);
    else if (!this.attempted && world.units.some((unit) => unit.champion === 'masteryi'))
      void this.load().catch(() => {
        /* Explicit load retries; no per-frame network loop. */
      });
  }
}
