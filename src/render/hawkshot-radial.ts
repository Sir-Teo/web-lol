import * as THREE from 'three';
import { HAWKSHOT_RADIAL as R } from '../content/hawkshot-radial';
import { radialParticles } from './hawkshot-radial-state';
import { hawkshotSmokeTextures } from './hawkshot-smoke';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

export class HawkshotRadial {
  mesh?: THREE.InstancedMesh;
  private capacity = 0;
  private material?: THREE.MeshBasicMaterial;
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private spin = new THREE.Matrix4();
  private rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(R.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
      'ZYX'
    )
  );
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  private allocate(count: number) {
    if (count <= this.capacity) return;
    if (!this.material) {
      this.material = new THREE.MeshBasicMaterial({
        map: hawkshotSmokeTextures().texture,
        color: new THREE.Color().setRGB(R.color[0], R.color[1], R.color[2]),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.material.forceSinglePass = true;
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = THREE.SrcAlphaFactor;
      this.material.blendDst = THREE.OneFactor;
      this.material.customProgramCacheKey = () => 'hawkshot-radial-atlas-v1';
      this.material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          'attribute vec2 radialFrameAlpha;\nvarying vec2 vRadial;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvRadial=radialFrameAlpha;'
          );
        shader.fragmentShader =
          'varying vec2 vRadial;\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            'vec2 radialUv=vMapUv*0.5+vec2(mod(vRadial.x,2.0),1.0-floor(vRadial.x/2.0))*0.5;\ndiffuseColor*=texture2D(map,radialUv);\ndiffuseColor.a*=vRadial.y;'
          );
      };
    }
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }
    this.capacity = Math.max(64, count, this.capacity * 2);
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute(
      'radialFrameAlpha',
      new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 2), 2)
    );
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    this.mesh.name = 'Hawkshot endpoint radial smoke';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  update(world: World, camera: THREE.Camera) {
    const particles = [];
    for (const area of world.visionAreas)
      if (area.kind === 'scout' && area.flight) {
        for (const p of radialParticles(area.flight, world.time)) {
          const point = { x: area.x + p.offset[0], y: area.y + p.offset[2] };
          if (area.team === 'blue' || world.pointVisible(point))
            particles.push({ ...p, point, height: this.ground(area) + p.offset[1] * 0.01 });
        }
      }
    this.allocate(particles.length);
    if (!this.mesh) return;
    this.mesh.count = particles.length;
    this.mesh.visible = particles.length > 0;
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const attr = this.mesh.geometry.getAttribute(
      'radialFrameAlpha'
    ) as THREE.InstancedBufferAttribute;
    particles.forEach((p, i) => {
      this.velocity.fromArray(p.velocity);
      const vx = this.velocity.dot(this.right),
        vy = this.velocity.dot(this.up);
      const angle = Math.abs(vx) + Math.abs(vy) > 0.0001 ? Math.atan2(-vx, vy) : 0;
      this.position.set(p.point.x * 0.01, p.height, p.point.y * 0.01);
      this.scale.fromArray(p.size);
      // Preview quad ordering: rotate corners, scale local axes, then authored XYZ rotation.
      this.matrix
        .compose(this.position, this.rotation, this.scale)
        .multiply(this.spin.makeRotationZ(angle));
      this.mesh!.setMatrixAt(i, this.matrix);
      attr.setXY(i, p.frame, p.alpha);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
  }
}
