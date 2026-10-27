import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { GrompAttack } from './gromp-attack';

export class LazyGrompAttack {
  /** Request a frame after a new renderer is ready, including while paused. */
  onReady?: () => void;
  private renderer?: GrompAttack;
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
      const module = await import('./gromp-attack');
      await module.loadGrompAttack();
      this.renderer = new module.GrompAttack(this.scene, this.ground);
      this.onReady?.();
    })().catch((e) => {
      this.pending = undefined;
      throw e;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      (world.units.some((u) => u.kind === 'monster' && u.monster.species === 'gromp') ||
        world.grompAttackVisuals.length)
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
}
