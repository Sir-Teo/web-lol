import * as THREE from 'three';
import { luxHoopParticles } from './lux-hoop-particles';
import { LUX_BASIC_HOOP_APPEARANCE as appearance } from '../content/lux-basic-lookups';
import { createParticleColorProductMaterial } from './particle-color-product';

/** Local emitter playback; textures are borrowed. The 60 Hz source reconstruction
 * and ADD blend interpretation are documented in PARTICLE-PLAYBACK.md.
 */
export class LuxHoopCloud {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly lookup = new THREE.InstancedBufferAttribute(new Float32Array(128 * 2), 2);
  private readonly transform = new THREE.Object3D();
  constructor(source: THREE.Texture, ramp: THREE.Texture) {
    this.geometry.setAttribute('particleLookupUv', this.lookup);
    const uv = this.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const material = createParticleColorProductMaterial(source, ramp, 'vertex');
    const [r, g, b, a] = appearance.birthColor;
    material.uniforms.particleColor.value.set(r * a, g * a, b * a, 1);
    material.transparent = true;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = material.blendDst = THREE.OneFactor;
    material.depthTest = true;
    this.mesh = new THREE.InstancedMesh(this.geometry, material, 128);
    this.mesh.name = 'Lux basic-attack hoop emitter';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lookup.setUsage(THREE.DynamicDrawUsage);
    // Local particles move through a small, bounded volume; do not use the
    // first update's instance bounds to cull later particles.
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }
  update(seed: number, seconds: number, stopSeconds: number, camera: THREE.Camera) {
    const particles = luxHoopParticles(seed, seconds, stopSeconds);
    if (particles.length > 128) throw new Error('Lux hoop instance capacity exceeded');
    camera.getWorldQuaternion(this.transform.quaternion);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      this.transform.position.fromArray(p.position).multiplyScalar(0.01);
      this.transform.scale.setScalar(p.size * 0.01);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(i, this.transform.matrix);
      this.lookup.setXY(i, p.lookup[0], p.lookup[1]);
    }
    this.mesh.count = particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.lookup.needsUpdate = true;
    return particles;
  }
  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
