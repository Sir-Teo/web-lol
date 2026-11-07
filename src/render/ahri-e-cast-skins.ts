import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { animationLayers } from '../simulation/animation-timeline';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { createLeonaEclipseSkinMaterial } from './leona-eclipse-skin-material';
import { AHRI_E_PROFILES, type AhriEParticle } from './ahri-e-particles';
import { AHRI_E_SKIN_BINDINGS } from './ahri-e-skin-bindings';
import { eVisualPose, eVisualAnimation, eVisualKnown, type EVisualGroup } from './ahri-e-history';

interface Instance {
  root: THREE.Group;
  sampler: TargetPoseSampler;
  material: THREE.ShaderMaterial;
}
const binding = AHRI_E_SKIN_BINDINGS.find((p) => p.system === 'Ahri_E_cas')!;
const profile = AHRI_E_PROFILES[binding.profileIndex];
/** Draw only the verified cast Tails selection. Buff Avatar has no resolved
 * selector policy and is not silently assigned a whole-body overlay. */
export class AhriECastSkins {
  readonly models = new Map<string, Instance>();
  private world?: World;
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number,
    private create: () => TargetPoseSampler = () => createTargetPoseSampler('ahri-base')
  ) {}
  private make(assets: EclipseSurfaceAssets): Instance {
    const e = profile.erosion!;
    const material = createLeonaEclipseSkinMaterial({
      texture: assets.texture(profile.texture, profile.uv.address),
      fresnel: binding.fresnelPower,
      fresnelColor: profile.reflection!.fresnelColor.slice(0, 3) as [number, number, number],
      erosion: {
        texture: assets.texture(e.texture, e.address),
        mixer: e.mixer.constant as [number, number, number, number],
        featherIn: e.featherIn,
        featherOut: e.featherOut,
        sliceWidth: e.sliceWidth,
      },
    });
    material.name = 'Ahri E attached Tails';
    material.uniforms.alphaRef = { value: profile.alphaRef };
    material.fragmentShader = material.fragmentShader
      .replace(
        'uniform sampler2D sourceTexture;',
        'uniform sampler2D sourceTexture; uniform float alphaRef;'
      )
      .replace('gl_FragColor = lit;', 'if (lit.a < alphaRef) discard; gl_FragColor = lit;');
    material.side = profile.noCull ? THREE.DoubleSide : THREE.FrontSide;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;
    material.depthTest = (profile.miscRenderFlags & 1) === 0;
    material.polygonOffsetFactor = profile.depthBias[0];
    material.polygonOffsetUnits = profile.depthBias[1];
    const root = new THREE.Group();
    let sampler: TargetPoseSampler | undefined;
    try {
      sampler = this.create();
      root.add(sampler.renderRoot);
      let selected = 0;
      sampler.renderRoot.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (!(node instanceof THREE.SkinnedMesh) || Array.isArray(node.material))
          throw Error('Unsupported E cast skin layout');
        node.visible = binding.matchedSubmeshes.includes(node.material.name);
        if (node.visible) {
          selected++;
          node.material = material;
          node.frustumCulled = false;
          node.castShadow = node.receiveShadow = false;
          node.renderOrder = profile.renderOrder;
        }
      });
      if (selected !== binding.matchedSubmeshes.length)
        throw Error('E cast skin source selection differs');
    } catch (error) {
      sampler?.dispose();
      material.dispose();
      throw error;
    }
    root.name = 'Ahri E attached cast';
    this.scene.add(root);
    return { root, sampler, material };
  }
  update(
    world: World,
    tick: number,
    groups: readonly { group: EVisualGroup; particles: readonly AhriEParticle[] }[],
    assets: EclipseSurfaceAssets
  ) {
    if (this.world !== world) {
      this.dispose();
      this.world = world;
    }
    const active = new Set<string>();
    for (const { group, particles } of groups) {
      if (group.role !== 'cast') continue;
      const particle = particles.find((p) => p.profileIndex === binding.profileIndex);
      if (
        !particle ||
        !eVisualKnown(group, group.startTick + particle.bornTick) ||
        !eVisualKnown(group, Math.min(tick, world.tick))
      )
        continue;
      const unit = world.unit(group.record.sourceId),
        pose = eVisualPose(group, Math.min(tick, world.tick));
      if (!unit || !pose || !world.visible(unit, 'blue')) continue;
      let instance = this.models.get(group.key);
      if (!instance) this.models.set(group.key, (instance = this.make(assets)));
      active.add(group.key);
      instance.root.position.set(pose.x * 0.01, this.ground(pose), pose.y * 0.01);
      instance.root.rotation.y = pose.facing;
      const animation = eVisualAnimation(group, Math.min(tick, world.tick));
      instance.sampler.sample(
        animation?.timeline
          ? animationLayers(animation.timeline, animation.at, MOBILE_CLIP_DURATIONS['ahri-base'])
          : []
      );
      instance.root.updateMatrixWorld(true);
      instance.material.uniforms.particleColor.value.fromArray(particle.color);
      instance.material.uniforms.erosionParameters.value.x = particle.erosion;
      const uv = particle.uv;
      instance.material.uniforms.sourceUvTransform.value.set(
        uv.scale[0] * uv.cellSize[0],
        0,
        ((1 - uv.scale[0]) * 0.5 + uv.offset[0]) * uv.cellSize[0] + uv.cell[0],
        0,
        uv.scale[1] * uv.cellSize[1],
        ((1 - uv.scale[1]) * 0.5 + uv.offset[1]) * uv.cellSize[1] + uv.cell[1],
        0,
        0,
        1
      );
      Object.assign(instance.root.userData, {
        sourceId: group.record.sourceId,
        castTick: group.record.castTick,
        profileIndex: binding.profileIndex,
        matchedSubmeshes: binding.matchedSubmeshes,
        unmatchedSelectors: binding.unmatchedSelectors,
        phase: particle.phase,
      });
    }
    for (const [key, instance] of this.models) if (!active.has(key)) this.release(key, instance);
  }
  private release(key: string, instance: Instance) {
    instance.root.removeFromParent();
    instance.sampler.dispose();
    instance.material.dispose();
    this.models.delete(key);
  }
  dispose() {
    for (const [key, instance] of this.models) this.release(key, instance);
    this.world = undefined;
  }
}
