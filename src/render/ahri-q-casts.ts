import * as THREE from 'three';
import data from '../content/ahri-q-cast-particles.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { animationLayers } from '../simulation/animation-timeline';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import { ahriQCastParticles } from './ahri-q-cast-particles';
import { ahriQCastAssets, loadAhriQCastAssets } from './ahri-q-cast-assets';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import { createLeonaEclipseSkinMaterial } from './leona-eclipse-skin-material';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
export { loadAhriQCastAssets as loadAhriQCasts };
interface Instance {
  root: THREE.Group;
  sampler: TargetPoseSampler;
  material: THREE.ShaderMaterial;
  center: THREE.Vector3;
}
interface Group extends SurfaceGroup {
  instance: Instance;
}
export interface AhriQCastResources extends EclipseSurfaceAssets {
  sampler(): TargetPoseSampler;
}
/** Bind-one cast effects follow a private current pose. Saved birth audience
 * prevents hidden births from appearing later; current visibility gates drawing.
 * The unmatched native selector remains unmatched. UV rotation precedes the
 * existing centered scale/scroll transform as an explicit local adapter. */
export class AhriQCasts {
  readonly models = new Map<string, Instance>();
  readonly surfaces: SourceParticleSurfaces<Group>;
  private groups: { sourceId: number; castTick: number; group: Group }[] = [];
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: AhriQCastResources
  ) {
    this.surfaces = new SourceParticleSurfaces(scene, scene, ground, {
      name: 'Ahri Q',
      attachment: 'C_Buffbone_Glb_Center_Loc',
      profiles: data.profiles,
      assets: () => this.supplied ?? ahriQCastAssets(),
      accepts: (i) => i < 2,
      records: () => this.groups,
      particles: (g, tick) => ahriQCastParticles((tick - g.startTick) / 60),
      birthVisible: () => true,
      visible: () => true,
      pose: (g) => ({
        x: g.instance.root.position.x * 100,
        y: g.instance.root.position.z * 100,
        facing: g.instance.root.rotation.y,
      }),
      attachmentPoint: (g) => g.instance.center,
    });
  }
  private create(): Instance {
    const assets = this.supplied ?? ahriQCastAssets()!,
      p = data.profiles[2],
      e = p.erosion!,
      r = p.reflection!;
    const material = createLeonaEclipseSkinMaterial({
      texture: assets.texture(p.texture, p.uv.address),
      fresnel: r.mappedPower,
      fresnelColor: r.color.slice(0, 3) as [number, number, number],
      erosion: {
        texture: assets.texture(e.texture, e.address),
        mixer: e.mixer.constant as [number, number, number, number],
        featherIn: e.featherIn,
        featherOut: e.featherOut,
        sliceWidth: e.sliceWidth,
      },
    });
    material.name = 'Ahri Q attached Tails';
    material.uniforms.alphaRef = { value: p.alphaRef };
    material.fragmentShader = material.fragmentShader
      .replace(
        'uniform sampler2D sourceTexture;',
        'uniform sampler2D sourceTexture; uniform float alphaRef;'
      )
      .replace('gl_FragColor = lit;', 'if (lit.a < alphaRef) discard; gl_FragColor = lit;');
    material.blendDst = THREE.OneMinusSrcAlphaFactor;
    material.polygonOffsetFactor = p.depthBias[0];
    material.polygonOffsetUnits = p.depthBias[1];
    const root = new THREE.Group();
    let sampler: TargetPoseSampler | undefined;
    try {
      sampler = this.supplied ? this.supplied.sampler() : createTargetPoseSampler('ahri-base');
      root.add(sampler.renderRoot);
      let selected = 0;
      sampler.renderRoot.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (!(node instanceof THREE.SkinnedMesh) || Array.isArray(node.material))
          throw Error('Unsupported Ahri Q character submesh layout');
        node.visible = (p.matchedSubmeshes as readonly string[]).includes(node.material.name);
        if (node.visible) {
          selected++;
          node.material = material;
          node.frustumCulled = false;
          node.castShadow = node.receiveShadow = false;
        }
      });
      if (selected !== p.matchedSubmeshes.length)
        throw Error('Ahri Q source submesh selection differs');
    } catch (error) {
      sampler?.dispose();
      material.dispose();
      throw error;
    }
    root.name = 'Ahri Q attached cast';
    this.scene.add(root);
    return { root, sampler, material, center: new THREE.Vector3() };
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    this.groups = [];
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (this.supplied ?? ahriQCastAssets())
      for (const r of world.ahriQCastVisuals) {
        if (!r.birth?.audience.includes('blue') || tick < r.birth.tick) continue;
        const particles = ahriQCastParticles((tick - r.birth.tick) / 60),
          unit = world.unit(r.sourceId);
        if (!particles.length || !unit || !world.pointVisible(unit)) continue;
        const key = `${r.sourceId}:${r.castTick}`;
        let instance = this.models.get(key);
        if (!instance) this.models.set(key, (instance = this.create()));
        active.add(key);
        const x = unit.previous.x + (unit.x - unit.previous.x) * alpha,
          y = unit.previous.y + (unit.y - unit.previous.y) * alpha;
        instance.root.position.set(x * 0.01, this.ground({ x, y }), y * 0.01);
        instance.root.rotation.y = unit.facing;
        instance.sampler.sample(
          unit.animationTimeline
            ? animationLayers(
                unit.animationTimeline,
                Math.min(tick, world.tick),
                MOBILE_CLIP_DURATIONS['ahri-base']
              )
            : []
        );
        instance.root.updateMatrixWorld(true);
        if (!instance.sampler.bonePosition('C_Buffbone_Glb_Center_Loc', instance.center))
          throw Error('Missing Ahri Q center attachment');
        const skin = particles.find((p) => p.profileIndex === 2)!;
        instance.material.uniforms.particleColor.value.fromArray(skin.color);
        instance.material.uniforms.erosionParameters.value.x = skin.erosion;
        Object.assign(instance.root.userData, {
          sourceId: r.sourceId,
          castTick: r.castTick,
          bornTick: r.birth.tick,
          phase: skin.phase,
          matchedSubmeshes: data.profiles[2].matchedSubmeshes,
        });
        this.groups.push({
          sourceId: r.sourceId,
          castTick: r.castTick,
          group: {
            key,
            startTick: r.birth.tick,
            stopTick: r.birth.tick + 240,
            radius: unit.radius,
            seed: 0,
            instance,
          },
        });
      }
    this.surfaces.update(world, alpha, camera, terminalAge);
    // All profiles are single particles with fixed authored UV rotation.
    for (const mesh of this.surfaces.models.values()) {
      const degrees = data.profiles[mesh.userData.profileIndex].uv.rotationDegrees.constant[0];
      if (degrees) {
        const angle = (degrees * Math.PI) / 180,
          c = Math.cos(angle),
          s = Math.sin(angle);
        mesh.material.uniforms.sourceUvTransform.value.multiply(
          new THREE.Matrix3().set(
            c,
            -s,
            0.5 - 0.5 * c + 0.5 * s,
            s,
            c,
            0.5 - 0.5 * s - 0.5 * c,
            0,
            0,
            1
          )
        );
      }
    }
    for (const [key, instance] of this.models) if (!active.has(key)) this.retire(key, instance);
  }
  private retire(key: string, instance: Instance) {
    instance.root.removeFromParent();
    instance.sampler.dispose();
    instance.material.dispose();
    instance.root.clear();
    this.models.delete(key);
  }
  dispose() {
    this.surfaces.dispose();
    for (const [key, instance] of this.models) this.retire(key, instance);
  }
}
