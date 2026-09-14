import { luxAttackPresentation } from './lux-attack-clock';
import depthProfiles from '../content/lux-flight-depth.json';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LUX_BASIC_CRESCENT as crescent } from '../content/lux-basic-crescent';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { luxCrescentParticles, type LuxCrescentParticle } from './lux-crescent-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
let geometry: THREE.BufferGeometry | undefined;
let textures: [THREE.Texture, THREE.Texture] | undefined;
export async function loadLuxCrescentAssets() {
  const [gltf, loaded] = await Promise.all([
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/lux-basic-crescent.glb`),
    Promise.all(
      ['ring04', 'color-rampdown'].map(async (name) => {
        const t = await new THREE.TextureLoader().loadAsync(
          `${import.meta.env.BASE_URL}assets/effects/lux-ba-${name}.png`
        );
        t.colorSpace = THREE.NoColorSpace;
        t.flipY = false;
        t.minFilter = t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        return t;
      })
    ),
  ]);
  textures = loaded as [THREE.Texture, THREE.Texture];
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    geometry = o.geometry;
    // The GLB's inspection material embeds an unneeded texture. Retain only its
    // source-space geometry; runtime owns separately loaded particle textures.
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
  if (!geometry) throw new Error('Lux source crescent has no mesh');
  return { geometry, source: textures[0], ramp: textures[1] };
}
export class LuxCrescentMesh {
  readonly mesh: THREE.InstancedMesh;
  private readonly ownGeometry: THREE.BufferGeometry;
  private readonly lookup = new THREE.InstancedBufferAttribute(new Float32Array(12), 2);
  private readonly transform = new THREE.Object3D();
  constructor(sourceGeometry: THREE.BufferGeometry, source: THREE.Texture, ramp: THREE.Texture) {
    this.ownGeometry = sourceGeometry.clone();
    this.ownGeometry.setAttribute('particleLookupUv', this.lookup);
    const material = createParticleColorProductMaterial(source, ramp, 'vertex');
    material.name = 'Lux crescent source ADD reconstruction';
    material.transparent = true;
    material.depthTest = (depthProfiles.crescentwhite.miscRenderFlags & 1) === 0;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = material.blendDst = THREE.OneFactor;
    this.mesh = new THREE.InstancedMesh(this.ownGeometry, material, 6);
    this.mesh.name = 'Lux basic-attack crescents';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lookup.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }
  update(particles: readonly LuxCrescentParticle[], ground: (p: Vec2) => number) {
    if (particles.length > 6) throw new Error('Lux crescent capacity exceeded');
    particles.forEach((p, i) => {
      const [x, y, z] = p.position;
      this.transform.position.set(x * 0.01, y * 0.01 + ground({ x, y: z }) + 0.9, z * 0.01);
      // Yaw of the birth frame, then authored local Z rotation. GLB positions
      // already include source-to-world 0.01; scale0 is dimensionless.
      this.transform.rotation.set(
        0,
        p.facing,
        (crescent.rotationDegrees[2] * Math.PI) / 180,
        'YXZ'
      );
      this.transform.scale.fromArray(p.scale);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(i, this.transform.matrix);
      this.lookup.setXY(i, p.lookup[0], p.lookup[1]);
    });
    this.mesh.count = particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.lookup.needsUpdate = true;
  }
  dispose() {
    this.ownGeometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
export class LuxAttackCrescents {
  readonly clouds = new Map<number, LuxCrescentMesh>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, terminalAge = 0) {
    if (!geometry || !textures) return;
    const active = new Set<number>();
    const { tick, effects } = luxAttackPresentation(world, alpha, terminalAge);
    for (const effect of effects) {
      active.add(effect.id);
      let cloud = this.clouds.get(effect.id);
      if (!cloud) {
        cloud = new LuxCrescentMesh(geometry, ...textures);
        this.clouds.set(effect.id, cloud);
        this.scene.add(cloud.mesh);
      }
      const particles = luxCrescentParticles(effect, tick).filter(
        (p) => effect.team === 'blue' || world.pointVisible({ x: p.position[0], y: p.position[2] })
      );
      cloud.update(particles, this.ground);
    }
    for (const [id, cloud] of this.clouds) {
      if (active.has(id)) continue;
      this.scene.remove(cloud.mesh);
      cloud.dispose();
      this.clouds.delete(id);
    }
  }
}
