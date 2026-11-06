import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { BaronSourceHits } from './baron-source-hits';

export class LazyBaronHits {
  onReady?: () => void;
  private renderer?: BaronSourceHits;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private closed = false;
  private empty = new Map<number, never>();
  constructor(
    private readonly scene: THREE.Scene,
    private readonly ground: (point: Vec2) => number
  ) {}
  get clouds() {
    return this.renderer?.clouds ?? this.empty;
  }
  load() {
    if (this.closed) return Promise.reject(Error('Baron hit preview is disposed'));
    return (this.pending ??= (async () => {
      const [{ loadBaronParticleResources }, { BaronSourceHits }] = await Promise.all([
        import('./baron-particle-resources'),
        import('./baron-source-hits'),
      ]);
      const resources = await loadBaronParticleResources(['hit']);
      if (this.closed) {
        resources.dispose();
        throw Error('Baron hit preview disposed during load');
      }
      this.renderer = new BaronSourceHits(this.scene, this.ground, resources);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.closed) return;
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.baronAttackVisuals.some((v) =>
        v.impact?.frames.some((f) => f.audience.includes(world.hero.team))
      )
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => {
        this.retryAfter = performance.now() + 5000;
      });
    }
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
  }
}
