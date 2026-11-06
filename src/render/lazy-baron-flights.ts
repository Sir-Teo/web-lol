import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { BaronSourceFlights } from './baron-source-flights';
export class LazyBaronFlights {
  onReady?: () => void;
  private renderer?: BaronSourceFlights;
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
  get loaded() {
    return !!this.renderer;
  }
  load() {
    if (this.closed) return Promise.reject(Error('Baron missile preview is disposed'));
    return (this.pending ??= (async () => {
      const [{ loadBaronParticleResources }, { BaronSourceFlights }] = await Promise.all([
        import('./baron-particle-resources'),
        import('./baron-source-flights'),
      ]);
      const resources = await loadBaronParticleResources(['missile']);
      if (this.closed) {
        resources.dispose();
        throw Error('Baron missile preview disposed during load');
      }
      this.renderer = new BaronSourceFlights(this.scene, this.ground, resources);
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
        v.frames.some((frame) => frame.audience.includes(world.hero.team))
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
