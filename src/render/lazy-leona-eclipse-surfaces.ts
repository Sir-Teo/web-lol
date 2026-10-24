import type * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LeonaEclipseSurfaces } from './leona-eclipse-surfaces';

export class LazyLeonaEclipseSurfaces {
  private renderer?: LeonaEclipseSurfaces;
  private pending?: Promise<void>;
  private retryAfter = 0;
  private empty = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private distortion: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  get models() {
    return this.renderer?.models ?? this.empty;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      const m = await import('./leona-eclipse-surfaces');
      await m.loadLeonaEclipseSurfaces();
      this.renderer = new m.LeonaEclipseSurfaces(this.scene, this.distortion, this.ground);
    })().catch((error) => {
      this.pending = undefined;
      throw error;
    }));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.renderer) this.renderer.update(world, alpha, camera, terminalAge);
    else if (
      performance.now() >= this.retryAfter &&
      world.units.some((u) => u.champion === 'leona')
    ) {
      this.retryAfter = Infinity;
      void this.load().catch(() => (this.retryAfter = performance.now() + 5000));
    }
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer?.prepareDepth(renderer, camera);
  }
  disposeDepth() {
    this.renderer?.depth.dispose();
  }
}
