import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HAWKSHOT_WIND as W } from '../content/hawkshot-wind';
import type { ScoutFlight } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';
import { configureHawkshotMaterial } from './hawkshot-material';
import { windParticles } from './hawkshot-wind-state';

let reference:
  | { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial; erosion: THREE.Texture }
  | undefined;
export async function loadHawkshotWind(): Promise<void> {
  const [gltf, erosion] = await Promise.all([
    new GLTFLoader().loadAsync('/assets/models/hawkshot-wind.glb'),
    new THREE.TextureLoader().loadAsync('/assets/effects/hawkshot-wind-erosion.png'),
  ]);
  let mesh: THREE.Mesh | undefined;
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) mesh = o;
  });
  if (!mesh || !mesh.geometry.getAttribute('color'))
    throw new Error('Wind source lacks vertex colors');
  erosion.colorSpace = THREE.NoColorSpace;
  erosion.wrapS = erosion.wrapT = THREE.MirroredRepeatWrapping;
  reference = {
    geometry: mesh.geometry,
    material: mesh.material as THREE.MeshBasicMaterial,
    erosion,
  };
}

/** One instanced draw for every currently visible wind particle, including arrival tails. */
export class HawkshotWind {
  mesh?: THREE.InstancedMesh;
  private capacity = 0;
  private material?: THREE.MeshBasicMaterial;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private facing = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}

  private allocate(count: number): void {
    if (count <= this.capacity) return;
    if (!reference) throw new Error('Wind source is not loaded');
    if (!this.material) {
      const material = reference.material.clone();
      material.opacity = 1;
      configureHawkshotMaterial(material);
      material.customProgramCacheKey = () => 'hawkshot-wind-erosion-v1';
      material.onBeforeCompile = (shader) => {
        shader.uniforms.windErosionMap = { value: reference!.erosion };
        shader.uniforms.windErosionParameters = {
          value: new THREE.Vector3(
            W.erosion.sliceWidth,
            1 / W.erosion.featherIn,
            1 / W.erosion.featherOut
          ),
        };
        shader.vertexShader =
          'attribute float windAlpha;\nattribute float windDrive;\nvarying vec2 vWind;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvWind = vec2(windAlpha, windDrive);'
          );
        shader.fragmentShader =
          'uniform sampler2D windErosionMap;\nuniform vec3 windErosionParameters;\nvarying vec2 vWind;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
float windThreshold = vWind.y - texture2D(windErosionMap, vMapUv).g;
float windMask = clamp((windThreshold + windErosionParameters.x) * windErosionParameters.y, 0.0, 1.0) - clamp(windThreshold * windErosionParameters.z, 0.0, 1.0);
diffuseColor.a *= vWind.x * windMask;`
          );
      };
      this.material = material;
    }
    this.capacity = Math.max(32, this.capacity * 2, count);
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }
    const geometry = reference.geometry.clone();
    geometry.setAttribute(
      'windAlpha',
      new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1)
    );
    geometry.setAttribute(
      'windDrive',
      new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1)
    );
    this.mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }

  update(world: World): void {
    const particles: Array<{
      flight: ScoutFlight;
      particle: ReturnType<typeof windParticles>[number];
    }> = [];
    const add = (flight: ScoutFlight, team: string) => {
      for (const particle of windParticles(flight, world.time))
        if (team === 'blue' || world.pointVisible(particle)) particles.push({ flight, particle });
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
    const alpha = this.mesh.geometry.getAttribute('windAlpha') as THREE.InstancedBufferAttribute;
    const drive = this.mesh.geometry.getAttribute('windDrive') as THREE.InstancedBufferAttribute;
    particles.forEach(({ flight, particle: p }, i) => {
      this.position.set(p.x * 0.01, this.ground(p) + 1.8 + p.lift, p.y * 0.01);
      this.scale.fromArray(p.scale);
      this.facing.setFromAxisAngle(
        THREE.Object3D.DEFAULT_UP,
        Math.atan2(flight.direction.x, flight.direction.y)
      );
      this.rotation.setFromEuler(
        this.euler.set(...(p.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]))
      );
      this.facing.multiply(this.rotation);
      this.matrix.compose(this.position, this.facing, this.scale);
      this.mesh!.setMatrixAt(i, this.matrix);
      alpha.setX(i, p.alpha);
      drive.setX(i, p.erosion);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    alpha.needsUpdate = drive.needsUpdate = true;
  }
}
