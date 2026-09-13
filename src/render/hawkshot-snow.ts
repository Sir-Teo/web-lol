import * as THREE from 'three';
import { HAWKSHOT_SNOW } from '../content/hawkshot-snow';
import { hawkshotDustTexture } from './hawkshot-dust';
import { snowParticles } from './hawkshot-snow-state';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

export class HawkshotSnow {
  mesh?: THREE.InstancedMesh;
  private capacity = 0;
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private material?: THREE.MeshBasicMaterial;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private spin = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 0, 1);
  constructor(
    readonly layer: number,
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  private allocate(count: number) {
    if (count <= this.capacity) return;
    const texture = hawkshotDustTexture(),
      D = HAWKSHOT_SNOW[this.layer];
    if (!this.material) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color().setRGB(D.color[0], D.color[1], D.color[2]),
        transparent: true,
        depthWrite: false,
      });
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneFactor;
      material.customProgramCacheKey = () => 'hawkshot-snow-atlas-v1';
      material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          'attribute float snowFrame;\nattribute float snowAlpha;\nvarying vec2 vSnow;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvSnow=vec2(snowFrame,snowAlpha);'
          );
        shader.fragmentShader =
          'varying vec2 vSnow;\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            `vec2 snowUv = vMapUv * 0.5 + vec2(mod(vSnow.x, 2.0), 1.0 - floor(vSnow.x / 2.0)) * 0.5;
diffuseColor *= texture2D(map, snowUv);
diffuseColor.a *= vSnow.y;`
          );
      };
      this.material = material;
    }
    this.capacity = Math.max(128, this.capacity * 2, count);
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (const name of ['snowFrame', 'snowAlpha'])
      geometry.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1)
      );
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = D.renderOrder;
    this.mesh.name = D.name;
    this.scene.add(this.mesh);
  }
  update(world: World, camera: THREE.Camera) {
    const particles: (ReturnType<typeof snowParticles>[number] & { ground: number })[] = [];
    const D = HAWKSHOT_SNOW[this.layer];
    for (const effect of world.scoutVisuals)
      for (const p of snowParticles(effect, world.time, this.layer))
        if (effect.team === 'blue' || world.pointVisible(p))
          particles.push({ ...p, ground: this.ground(effect) });
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    this.allocate(particles.length);
    if (!this.mesh) return;
    this.mesh.count = particles.length;
    this.mesh.visible = particles.length > 0;
    const frame = this.mesh.geometry.getAttribute('snowFrame') as THREE.InstancedBufferAttribute;
    const alpha = this.mesh.geometry.getAttribute('snowAlpha') as THREE.InstancedBufferAttribute;
    particles.forEach((p, i) => {
      this.position.set(p.x * 0.01, p.ground + p.height, p.y * 0.01);
      this.scale.set(p.width, p.heightSize, 1);
      const vx = p.vy * this.right.y,
        vy = p.vy * this.up.y;
      const angle =
        D.directionOriented && Math.abs(vx) + Math.abs(vy) > 0.0001
          ? Math.atan2(-vx, vy)
          : p.rotation;
      this.spin.setFromAxisAngle(this.axis, angle);
      camera.getWorldQuaternion(this.rotation).multiply(this.spin);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.mesh!.setMatrixAt(i, this.matrix);
      frame.setX(i, p.frame);
      alpha.setX(i, p.alpha);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    frame.needsUpdate = alpha.needsUpdate = true;
  }
}
