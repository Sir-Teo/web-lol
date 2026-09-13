import * as THREE from 'three';
import { HAWKSHOT_DUST as D } from '../content/hawkshot-dust';
import { dustParticles } from './hawkshot-dust-state';
import type { ScoutFlight } from '../simulation/types';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let texture: THREE.Texture | undefined;
export function hawkshotDustTexture() {
  if (!texture) throw new Error('Hawkshot dust atlas is not loaded');
  return texture;
}
export async function loadHawkshotDust() {
  texture = await new THREE.TextureLoader().loadAsync('/assets/effects/hawkshot-dust.png');
  texture.colorSpace = THREE.SRGBColorSpace;
}

export class HawkshotDust {
  mesh?: THREE.InstancedMesh;
  private capacity = 0;
  private material?: THREE.MeshBasicMaterial;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private spin = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 0, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  private allocate(count: number) {
    if (count <= this.capacity) return;
    if (!texture) throw new Error('Hawkshot dust atlas is not loaded');
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
      material.customProgramCacheKey = () => 'hawkshot-dust-atlas-v1';
      material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          'attribute float dustFrame;\nattribute float dustAlpha;\nvarying vec2 vDust;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvDust=vec2(dustFrame,dustAlpha);'
          );
        shader.fragmentShader =
          'varying vec2 vDust;\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            `vec2 dustUv = vMapUv * 0.5 + vec2(mod(vDust.x, 2.0), 1.0 - floor(vDust.x / 2.0)) * 0.5;
diffuseColor *= texture2D(map, dustUv);
diffuseColor.a *= vDust.y;`
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
    for (const name of ['dustFrame', 'dustAlpha'])
      geometry.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1)
      );
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = D.renderOrder;
    this.scene.add(this.mesh);
  }
  update(world: World, camera: THREE.Camera) {
    const particles: ReturnType<typeof dustParticles> = [];
    const add = (flight: ScoutFlight, team: string) => {
      for (const p of dustParticles(flight, world.time))
        if (team === 'blue' || world.pointVisible(p)) particles.push(p);
    };
    for (const p of world.projectiles)
      if (p.type === 'hawkshot')
        add(
          {
            id: p.id,
            origin: p.origin!,
            direction: p.direction,
            speed: p.speed,
            launchTick: p.launchTick!,
          },
          p.team
        );
    for (const area of world.visionAreas)
      if (area.kind === 'scout' && area.flight) add(area.flight, area.team);
    this.allocate(particles.length);
    if (!this.mesh) return;
    this.mesh.count = particles.length;
    const frame = this.mesh.geometry.getAttribute('dustFrame') as THREE.InstancedBufferAttribute;
    const alpha = this.mesh.geometry.getAttribute('dustAlpha') as THREE.InstancedBufferAttribute;
    particles.forEach((p, i) => {
      this.position.set(p.x * 0.01, this.ground(p.birthPoint) + 1.8 + p.lift, p.y * 0.01);
      this.scale.setScalar(p.size);
      this.spin.setFromAxisAngle(this.axis, p.rotation);
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
