import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { PrimaryHits } from './masteryi-primary-hits';

/** The private Yi pack stays out of ordinary Ashe/Lux startup. */
export class LazyPrimaryHits {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: PrimaryHits;
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
      const module = await import('./masteryi-primary-hits');
      await module.loadPrimaryHits();
      this.renderer = new module.PrimaryHits(this.scene, this.ground);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0): void {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (!this.attempted && world.units.some((unit) => unit.champion === 'masteryi'))
      void this.load().catch(() => {
        /* Explicit load retries; no per-frame network loop. */
      });
  }
}
