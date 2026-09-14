import { LuxImpactAttachments } from './lux-impact-attachments';
import { createMobileTargetPoseSampler } from './models';
import type { MobileRig } from '../content/mobile-clip-durations';
import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import profiles from '../content/lux-impact-rings.json';
import sparkProfile from '../content/lux-impact-sparks.json';
import { luxImpactRings } from './lux-impact-rings';
import { luxImpactSparks } from './lux-impact-sparks';
import { LuxImpactSparkCloud } from './lux-impact-spark-cloud';
import { luxImpactSparkAnchor } from './lux-impact-frame';
import { luxHoopChance } from './lux-hoop-particles';
import { particleAtlasUv } from './particle-atlas';
import { createParticleColorProductMaterial } from './particle-color-product';
const sparkPath = 'assets/effects/lux-hit-lux_base_r_spark.png';
const palettePath = 'assets/effects/lux-hit-flame_trail_gradient.png';
let textures: Map<string, THREE.Texture> | undefined;
let white: THREE.DataTexture;
export async function loadLuxImpactTextures() {
  const loaded = new Map<string, THREE.Texture>();
  await Promise.all(
    [
      ...new Set([
        sparkPath,
        palettePath,
        ...profiles.flatMap((p) => [p.source, ...(p.lookup ? [p.lookup] : [])]),
      ]),
    ].map(async (path) => {
      const t = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      loaded.set(path, t);
    })
  );
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  textures = loaded;
}
function createCloud(rig: MobileRig | null, ground: (p: Vec2) => number) {
  const rings = profiles.map((p) => {
    const geometry = new THREE.PlaneGeometry(2, 2),
      uv = geometry.getAttribute('uv');
    for (let i = 0; i < 4; i++)
      uv.setXY(i, ...particleAtlasUv(p.atlas[0], p.atlas[1], p.atlas[2], i % 2, Math.floor(i / 2)));
    const material = createParticleColorProductMaterial(
      textures!.get(p.source)!,
      p.lookup ? textures!.get(p.lookup)! : white
    );
    material.transparent = true;
    material.depthTest = true;
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = p.blend === 4 ? THREE.SrcAlphaFactor : THREE.OneFactor;
    material.blendDst = THREE.OneFactor;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Lux impact ' + p.name;
    return { profile: p, mesh };
  });
  const sparks = new LuxImpactSparkCloud(
    textures!.get(sparkPath)!,
    textures!.get(palettePath)!,
    white
  );
  (sparks.mesh.material as THREE.Material).depthTest = true;
  return {
    rings,
    sparks,
    rig,
    attachments: new LuxImpactAttachments(rig ? createMobileTargetPoseSampler(rig) : null, ground),
  };
}
/** Saved mobile bone paths drive emitter placement and inherited translation.
 * Unsupported structure/dummy poses retain +0.9; source orientation is uncalibrated.
 */
export class LuxImpacts {
  readonly clouds = new Map<number, ReturnType<typeof createCloud>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera) {
    if (!textures) return;
    const active = new Set<number>(),
      tick = world.tick - 1 + alpha;
    for (const effect of world.luxImpactVisuals) {
      active.add(effect.id);
      let cloud = this.clouds.get(effect.id);
      if (cloud && cloud.rig !== effect.targetRig) {
        this.release(cloud);
        cloud = undefined;
      }
      if (!cloud) {
        cloud = createCloud(effect.targetRig, this.ground);
        this.clouds.set(effect.id, cloud);
        this.scene.add(...cloud.rings.map((r) => r.mesh), cloud.sparks.mesh);
      }
      const birthTick = effect.startTick + 1,
        age = (tick - birthTick) / 60;
      const pointAt = (at: number) => cloud!.attachments.point(effect, at);
      const birth = pointAt(birthTick),
        current = pointAt(tick);
      const states = luxImpactRings(age, effect.critical, luxHoopChance(effect.id, 0));
      for (const { profile, mesh } of cloud.rings) {
        const state = states.find((p) => p.name === profile.name);
        const point = birth.clone().lerp(current, profile.bind);
        mesh.visible =
          !!state &&
          (effect.team === 'blue' || world.pointVisible({ x: point.x * 100, y: point.z * 100 }));
        if (!state || !mesh.visible) continue;
        mesh.position.copy(point);
        camera.getWorldQuaternion(mesh.quaternion);
        mesh.rotateZ((-state.rotation * Math.PI) / 180);
        mesh.scale.setScalar(state.size * 0.01);
        const [r, g, b, a] = state.color;
        mesh.material.uniforms.particleColor.value.set(
          ...((profile.blend === 0 ? [r * a, g * a, b * a, 1] : [r, g, b, a]) as [
            number,
            number,
            number,
            number,
          ])
        );
        mesh.material.uniforms.lookupUv.value.fromArray(state.lookup);
      }
      const anchor = luxImpactSparkAnchor(effect.startTick, tick, pointAt);
      const segmentStart = luxImpactSparkAnchor(effect.startTick, Math.ceil(tick) - 1, pointAt);
      const segmentEnd = luxImpactSparkAnchor(effect.startTick, Math.ceil(tick), pointAt);
      // Particle velocities/positions are source units; attachments are world units.
      const parentVelocity = segmentEnd.sub(segmentStart).multiplyScalar(6000).toArray();
      const particles = luxImpactSparks(effect.id, age)
        .map((p) => ({
          ...p,
          velocity: p.velocity.map((v, i) => v + parentVelocity[i]),
          stretch: Math.max(
            sparkProfile.directionMin,
            Math.hypot(...p.velocity.map((v, i) => v + parentVelocity[i])) *
              sparkProfile.directionScale
          ),
          position: [
            p.position[0] + anchor.x * 100,
            p.position[1] + anchor.y * 100,
            p.position[2] + anchor.z * 100,
          ],
        }))
        .filter(
          (p) =>
            effect.team === 'blue' || world.pointVisible({ x: p.position[0], y: p.position[2] })
        );
      cloud.sparks.drawParticles(particles, camera);
    }
    for (const [id, cloud] of this.clouds)
      if (!active.has(id)) {
        this.release(cloud);
        this.clouds.delete(id);
      }
  }
  private release(cloud: ReturnType<typeof createCloud>) {
    for (const { mesh } of cloud.rings) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.scene.remove(cloud.sparks.mesh);
    cloud.sparks.dispose();
    cloud.attachments.dispose();
  }
}
