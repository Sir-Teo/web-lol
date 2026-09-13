import * as THREE from 'three';
import { SceneDepth } from './scene-depth';
import { HAWKSHOT_SMOKE as D } from '../content/hawkshot-smoke';
import { smokeParticles } from './hawkshot-smoke-state';
import type { ScoutFlight } from '../simulation/types';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let texture: THREE.Texture | undefined;
let erosion: THREE.Texture;
export async function loadHawkshotSmoke() {
  [texture, erosion] = await Promise.all([
    new THREE.TextureLoader().loadAsync('/assets/effects/hawkshot-smoke.png'),
    new THREE.TextureLoader().loadAsync('/assets/effects/hawkshot-smoke-erosion.png'),
  ]);
  erosion.colorSpace = THREE.NoColorSpace;
  erosion.wrapS = erosion.wrapT = THREE.MirroredRepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
}

export class HawkshotSmoke {
  mesh?: THREE.InstancedMesh;
  private capacity = 0;
  depth = new SceneDepth();
  uniforms = {
    smokeDepth: { value: null as THREE.Texture | null },
    smokeCamera: { value: new THREE.Vector4() },
  };
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
    if (!texture) throw new Error('Hawkshot smoke atlas is not loaded');
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
      material.customProgramCacheKey = () => 'hawkshot-smoke-atlas-v1';
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms, { smokeErosion: { value: erosion } });
        shader.vertexShader =
          'attribute float smokeFrame;\nattribute float smokeAlpha;\nattribute float smokeDrive;\nvarying vec3 vSmoke;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvSmoke=vec3(smokeFrame,smokeAlpha,smokeDrive);'
          );
        shader.fragmentShader =
          'varying vec3 vSmoke;\nuniform sampler2D smokeErosion;\nuniform sampler2D smokeDepth;\nuniform vec4 smokeCamera;\n#include <packing>\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            `vec2 smokeUv = vMapUv * 0.5 + vec2(mod(vSmoke.x, 2.0), 1.0 - floor(vSmoke.x / 2.0)) * 0.5;
diffuseColor *= texture2D(map, smokeUv);
float threshold = vSmoke.z - texture2D(smokeErosion, smokeUv).r;
float mask = clamp((threshold + 1.5) * 10.0, 0.0, 1.0) - clamp(threshold / ${D.erosionFeatherOut}, 0.0, 1.0);
float backgroundZ = texture2D(smokeDepth, gl_FragCoord.xy / smokeCamera.zw).r;
float gap = perspectiveDepthToViewZ(gl_FragCoord.z, smokeCamera.x, smokeCamera.y) - perspectiveDepthToViewZ(backgroundZ, smokeCamera.x, smokeCamera.y);
diffuseColor.a *= vSmoke.y * mask * smoothstep(0.0, ${D.softDistance}, gap);`
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
    for (const name of ['smokeFrame', 'smokeAlpha', 'smokeDrive'])
      geometry.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1)
      );
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.scene.add(this.mesh);
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    if (!this.mesh?.count) {
      this.depth.dispose();
      return;
    }
    const target = this.depth.capture(renderer, this.scene, camera);
    this.uniforms.smokeDepth.value = target.depthTexture;
    this.uniforms.smokeCamera.value.set(camera.near, camera.far, target.width, target.height);
  }
  update(world: World, camera: THREE.Camera) {
    const particles: ReturnType<typeof smokeParticles> = [];
    const add = (flight: ScoutFlight, team: string) => {
      for (const p of smokeParticles(flight, world.time))
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
    const frame = this.mesh.geometry.getAttribute('smokeFrame') as THREE.InstancedBufferAttribute;
    const alpha = this.mesh.geometry.getAttribute('smokeAlpha') as THREE.InstancedBufferAttribute;
    const drive = this.mesh.geometry.getAttribute('smokeDrive') as THREE.InstancedBufferAttribute;
    particles.forEach((p, i) => {
      this.position.set(p.x * 0.01, this.ground(p) + 1.8, p.y * 0.01);
      this.scale.set(p.width, p.height, 1);
      this.spin.setFromAxisAngle(this.axis, p.rotation);
      camera.getWorldQuaternion(this.rotation).multiply(this.spin);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.mesh!.setMatrixAt(i, this.matrix);
      frame.setX(i, p.frame);
      alpha.setX(i, p.alpha);
      drive.setX(i, p.erosion);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    frame.needsUpdate = alpha.needsUpdate = drive.needsUpdate = true;
  }
}
