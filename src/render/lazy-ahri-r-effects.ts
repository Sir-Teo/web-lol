import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { AhriRParticles } from './ahri-r-effects';
/** Ahri source particles are loaded only for a roster containing Ahri. */
export class LazyAhriRParticles {
  onReady?: () => void;
  private renderer?: AhriRParticles;
  private pending?: Promise<void>;
  private attempted = false;
  private closed = false;
  get ready() {
    return !!this.renderer;
  }
  get models() {
    return this.renderer?.models;
  }
  get surfaces() {
    return this.renderer?.surfaces;
  }
  get buffSurfaces() {
    return this.renderer?.buffs.surfaces;
  }
  get deferredProfiles() {
    return this.renderer?.deferredProfiles ?? [];
  }
  get attachmentFallbacks() {
    return this.renderer?.attachmentFallbacks ?? [];
  }
  constructor(
    private scene: THREE.Scene,
    private distortion: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  load(): Promise<void> {
    if (this.closed) return Promise.reject(Error('Ahri R renderer disposed'));
    if (this.renderer) return Promise.resolve();
    this.attempted = true;
    return (this.pending ??= (async () => {
      const module = await import('./ahri-r-effects');
      await module.loadAhriRParticles();
      if (this.closed) return;
      this.renderer = new module.AhriRParticles(this.scene, this.distortion, this.ground);
      this.onReady?.();
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.closed) return;
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (!this.attempted && world.units.some((u) => u.champion === 'ahri'))
      void this.load().catch(() => {
        /* Explicit retry; no frame-driven retry loop. */
      });
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer?.prepareDepth(renderer, camera);
  }
  dispose() {
    this.closed = true;
    this.renderer?.dispose();
    this.renderer = undefined;
  }
}
