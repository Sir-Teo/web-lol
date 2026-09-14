import * as THREE from 'three';
import type { MapTextureResidency } from './map-texture-residency';

/** A small border around the current view provides lead time during panning.
 * Visible draws still upload missing textures normally at original resolution. */
export class MapTexturePrefetch {
  private projection = new THREE.Matrix4();
  private clip = new THREE.Matrix4();
  private frustum = new THREE.Frustum();
  private nearby = new Map<THREE.Texture, number>();
  constructor(
    private root: THREE.Object3D,
    private residency: MapTextureResidency,
    private textures: ReadonlyMap<THREE.Object3D, ReadonlyMap<THREE.Texture, number>>
  ) {}
  update(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    this.projection.copy(camera.projectionMatrix);
    this.projection.elements[0] /= 1.15;
    this.projection.elements[5] /= 1.15;
    this.clip.multiplyMatrices(this.projection, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.clip, camera.coordinateSystem);
    this.nearby.clear();
    this.root.traverseVisible((object) => {
      const textures = this.textures.get(object);
      if (!textures || !object.layers.test(camera.layers)) return;
      if (object.frustumCulled && !this.frustum.intersectsObject(object)) return;
      for (const [texture, bytes] of textures) this.nearby.set(texture, bytes);
    });
    return this.residency.prefetch(this.nearby, (texture) => renderer.initTexture(texture));
  }
}
