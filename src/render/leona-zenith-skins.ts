import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { animationLayers } from '../simulation/animation-timeline';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import { createLeonaEclipseSkinMaterial } from './leona-eclipse-skin-material';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { ZENITH_PROFILES, zenithParticles } from './leona-zenith-particles';
import { zenithBirthFrame, zenithDrawGroups, zenithPoseAt } from './leona-zenith-history';
import { eclipseValue } from './leona-eclipse-values';

export interface ZenithSkinResources {
  texture(path: string, address: number): THREE.Texture;
  sampler(): TargetPoseSampler;
}
interface SkinInstance {
  root: THREE.Group;
  sampler: TargetPoseSampler;
  material: THREE.ShaderMaterial;
  meshes: THREE.SkinnedMesh[];
}
let resources: ZenithSkinResources | undefined, pending: Promise<void> | undefined;
const key = (path: string, address: number) => `${path}:${address}`;
export function loadLeonaZenithSkins(): Promise<void> {
  return (pending ??= (async () => {
    const profiles = ZENITH_PROFILES.filter((p) => p.kind === 'skin'),
      images = await loadLuxParticleTextures(
        profiles.flatMap((p) => [p.texture, ...(p.erosion ? [p.erosion.texture] : [])])
      ),
      textures = new Map<string, THREE.Texture>();
    for (const p of profiles)
      for (const [path, address] of [
        [p.texture, p.uv.address],
        ...(p.erosion ? [[p.erosion.texture, p.erosion.address] as const] : []),
      ] as const) {
        const id = key(path, address);
        if (textures.has(id)) continue;
        const copy = images.get(path)!.clone();
        copy.wrapS = copy.wrapT = [
          THREE.RepeatWrapping,
          THREE.MirroredRepeatWrapping,
          THREE.ClampToEdgeWrapping,
        ][address];
        copy.needsUpdate = true;
        textures.set(id, copy);
      }
    resources = {
      texture: (path, address) => textures.get(key(path, address))!,
      sampler: () => createTargetPoseSampler('leona-base'),
    };
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}

/** The single authored arrival skin uses a private complete Leona rig. Missing
 * authored reflection is locally bound to a zero rim; native VS5/PS34 still
 * exposes that uniform, so its actual CPU default is not claimed. This reuses
 * the observed base/tint/remap/erosion path without the ordinary sword shader. */
export class LeonaZenithSkins {
  readonly models = new Map<string, SkinInstance>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: ZenithSkinResources
  ) {}
  private create(profileIndex: number) {
    const p = ZENITH_PROFILES[profileIndex],
      e = p.erosion,
      images = this.supplied ?? resources!;
    if (p.kind !== 'skin' || p.reflection || p.lookup || !e)
      throw Error('Unsupported Zenith attached-skin material');
    const material = createLeonaEclipseSkinMaterial({
      texture: images.texture(p.texture, p.uv.address),
      fresnel: 1,
      fresnelColor: [0, 0, 0],
      erosion: {
        texture: images.texture(e.texture, e.address),
        mixer: e.mixer.constant as [number, number, number, number],
        featherIn: e.featherIn,
        featherOut: e.featherOut,
        sliceWidth: e.sliceWidth,
      },
    });
    let sampler: TargetPoseSampler | undefined;
    const root = new THREE.Group(),
      meshes: THREE.SkinnedMesh[] = [];
    try {
      sampler = images.sampler();
      root.add(sampler.renderRoot);
      sampler.renderRoot.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (!(node instanceof THREE.SkinnedMesh))
          throw Error('Zenith source character has an unskinned submesh');
        node.material = material;
        node.frustumCulled = false;
        node.castShadow = node.receiveShadow = false;
        node.renderOrder = p.renderOrder;
        meshes.push(node);
      });
      if (!meshes.length) throw Error('Zenith source character has no skinned mesh');
    } catch (error) {
      sampler?.dispose();
      material.dispose();
      throw error;
    }
    root.name = `Leona E ${p.name}`;
    this.scene.add(root);
    return { root, sampler, material, meshes };
  }
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (this.supplied || resources)
      for (const unit of world.units) {
        const state = world.championState(unit.id);
        if (!state?.leonaEVisuals.length) continue;
        for (const r of state.leonaEVisuals)
          for (const group of zenithDrawGroups(unit.id, r)) {
            if (group.role !== 'arrival') continue;
            const pose = zenithPoseAt(group.frames, tick);
            if (!pose || !world.pointVisible(pose)) continue;
            for (const p of zenithParticles(
              group.role,
              group.seed,
              (tick - group.startTick) / 60,
              Infinity,
              group.radius
            )) {
              const profile = ZENITH_PROFILES[p.profileIndex];
              if (profile.kind !== 'skin' || !zenithBirthFrame(group, p.bornTick, !!world.winner))
                continue;
              const id = `${group.key}:${p.profileIndex}:${p.ordinal}`;
              let model = this.models.get(id);
              if (!model) this.models.set(id, (model = this.create(p.profileIndex)));
              active.add(id);
              model.root.position.set(pose.x * 0.01, this.ground(pose), pose.y * 0.01);
              model.root.rotation.y = pose.facing;
              model.sampler.sample(
                pose.timeline
                  ? animationLayers(
                      pose.timeline,
                      pose.poseTick,
                      MOBILE_CLIP_DURATIONS['leona-base']
                    )
                  : []
              );
              model.material.uniforms.particleColor.value.fromArray(p.color);
              const uv = p.uv;
              model.material.uniforms.sourceUvTransform.value.set(
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
              model.material.uniforms.erosionParameters.value.x = p.erosion;
              model.material.uniforms.erosionMixer.value.fromArray(
                eclipseValue(profile.erosion!.mixer, p.phase)
              );
              Object.assign(model.root.userData, {
                sourceId: unit.id,
                castTick: r.startTick,
                profileIndex: p.profileIndex,
                role: group.role,
                ordinal: p.ordinal,
                bornTick: group.startTick + p.bornTick,
                phase: p.phase,
                poseTick: pose.poseTick,
              });
            }
          }
      }
    for (const [id, model] of this.models) if (!active.has(id)) this.retire(id, model);
  }
  private retire(id: string, model: SkinInstance) {
    this.scene.remove(model.root);
    model.sampler.dispose();
    model.material.dispose();
    model.root.clear();
    this.models.delete(id);
  }
  dispose() {
    for (const [id, model] of this.models) this.retire(id, model);
  }
}
