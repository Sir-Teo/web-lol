import * as THREE from 'three';
import { createParticleColorProductMaterial } from './particle-color-product';
import { luxImpactSparks } from './lux-impact-sparks';

/** Camera-facing direction alignment and speed stretch follow the source
 * reconstruction; exact native basis and sampler state remain uncaptured.
 * Textures are borrowed. Positions and extents convert source units by 0.01.
 */
export class LuxImpactSparkCloud {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly tint = new THREE.InstancedBufferAttribute(new Float32Array(5 * 4), 4);
  private readonly transform = new THREE.Object3D();
  private readonly cameraRotation = new THREE.Quaternion();
  private readonly inverseCameraRotation = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly zAxis = new THREE.Vector3(0, 0, 1);
  constructor(source: THREE.Texture, palette: THREE.Texture, white: THREE.Texture) {
    const uv = this.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.geometry.setAttribute('particleTint', this.tint);
    const material = createParticleColorProductMaterial(source, white, 'uniform', undefined, true, {
      texture: palette,
      sourceMix: [0, 1, 0, 0],
      row: 0.95,
    });
    material.transparent = true;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = material.blendDst = THREE.OneFactor;
    this.mesh = new THREE.InstancedMesh(this.geometry, material, 5);
    this.mesh.name = 'Lux impact sparks';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint.setUsage(THREE.DynamicDrawUsage);
  }
  draw(seed: number, age: number, camera: THREE.Camera) {
    const particles = luxImpactSparks(seed, age);
    camera.getWorldQuaternion(this.cameraRotation);
    this.inverseCameraRotation.copy(this.cameraRotation).invert();
    particles.forEach((p, i) => {
      this.transform.position.fromArray(p.position).multiplyScalar(0.01);
      this.direction.fromArray(p.velocity).applyQuaternion(this.inverseCameraRotation);
      const angle =
        this.direction.x ** 2 + this.direction.y ** 2 > 1e-12
          ? Math.atan2(-this.direction.x, this.direction.y)
          : 0;
      this.turn.setFromAxisAngle(this.zAxis, angle);
      this.transform.quaternion.copy(this.cameraRotation).multiply(this.turn);
      this.transform.scale.set(p.scale[0] * 0.01, p.scale[1] * p.stretch * 0.01, 1);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(i, this.transform.matrix);
      const [r, g, b, a] = p.color;
      this.tint.setXYZW(i, r * a, g * a, b * a, 1);
    });
    this.mesh.count = particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
    return particles;
  }
  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
