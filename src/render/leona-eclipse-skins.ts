import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { animationLayers } from '../simulation/animation-timeline';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import {
  createLeonaEclipseSkinMaterial,
  leonaEclipseSkinFresnel,
} from './leona-eclipse-skin-material';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { ECLIPSE_PROFILES, eclipseParticles } from './leona-eclipse-particles';
import { eclipseBirthFrame, eclipseDrawGroups, eclipsePoseAt } from './leona-eclipse-history';

let textures: Map<string, THREE.Texture> | undefined;
const skinProfiles = ECLIPSE_PROFILES.filter((p) => p.kind === 'skin');
export async function loadLeonaEclipseSkins() {
  if (textures) return;
  const source = await loadLuxParticleTextures(
    skinProfiles.flatMap((p) => [p.texture, ...(p.erosion ? [p.erosion.texture] : [])])
  );
  // Separate sampler objects share decoded images, without changing another
  // effect's session-owned texture state. These W samplers live for the session.
  textures = new Map(
    [...source].map(([path, texture]) => {
      const copy = texture.clone();
      copy.wrapS = copy.wrapT = path.includes('erosion')
        ? THREE.MirroredRepeatWrapping
        : THREE.RepeatWrapping;
      copy.needsUpdate = true;
      return [path, copy];
    })
  );
}
interface SkinInstance {
  root: THREE.Group;
  sampler: TargetPoseSampler;
  material: THREE.ShaderMaterial;
  meshes: THREE.SkinnedMesh[];
}
interface SkinResources {
  textures: Map<string, THREE.Texture>;
  sampler: () => TargetPoseSampler;
}

/** Attached-character particles draw the complete authored mesh with a private
 * historical pose. Every birth owns its skeleton/material, while geometry and
 * source images remain shared. No live actor or gameplay clock is advanced. */
export class LeonaEclipseSkins {
  readonly models = new Map<string, SkinInstance>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private resources?: SkinResources
  ) {}
  private create(profileIndex: number): SkinInstance {
    const p = ECLIPSE_PROFILES[profileIndex],
      images = this.resources?.textures ?? textures!,
      e = p.erosion;
    const material = createLeonaEclipseSkinMaterial({
      texture: images.get(p.texture)!,
      fresnel: leonaEclipseSkinFresnel(profileIndex, p.reflection!.power),
      fresnelColor: p.reflection!.color.slice(0, 3) as [number, number, number],
      ...(e
        ? {
            erosion: {
              texture: images.get(e.texture)!,
              mixer: e.mixer.constant as [number, number, number, number],
              featherIn: e.featherIn,
              featherOut: e.featherOut,
              sliceWidth: e.sliceWidth,
            },
          }
        : {}),
    });
    let sampler: TargetPoseSampler | undefined;
    const root = new THREE.Group(),
      meshes: THREE.SkinnedMesh[] = [];
    try {
      sampler = this.resources?.sampler() ?? createTargetPoseSampler('leona-base');
      root.add(sampler.renderRoot);
      sampler.renderRoot.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (!(node instanceof THREE.SkinnedMesh))
            throw Error('Eclipse source character contains an unsupported unskinned submesh');
          node.material = material;
          node.frustumCulled = false;
          node.castShadow = node.receiveShadow = false;
          node.renderOrder = p.renderOrder;
          meshes.push(node);
        }
      });
      if (!meshes.length) throw Error('Eclipse source character has no skinned mesh');
    } catch (error) {
      sampler?.dispose();
      material.dispose();
      throw error;
    }
    root.name = `Leona W ${p.role} ${p.name}`;
    this.scene.add(root);
    return { root, sampler, material, meshes };
  }
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (this.resources || textures)
      for (const unit of world.units) {
        const state = world.championState(unit.id);
        if (!state?.leonaWVisuals.length) continue;
        for (const r of state.leonaWVisuals)
          for (const group of eclipseDrawGroups(unit.id, r)) {
            if (group.role !== 'buff-initial' && group.role !== 'buff-extended') continue;
            const pose = eclipsePoseAt(group.frames, tick);
            if (!world.pointVisible(pose)) continue;
            for (const p of eclipseParticles(
              group.role,
              group.seed,
              (tick - group.startTick) / 60,
              (group.stopTick - group.startTick) / 60,
              group.radius
            )) {
              const profile = ECLIPSE_PROFILES[p.profileIndex];
              if (profile.kind !== 'skin' || !eclipseBirthFrame(group, p.bornTick, !!world.winner))
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
              // These four source descriptions author identity UVs. Keep the common
              // sampled transform routed so future source changes cannot be ignored.
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
              if (profile.erosion) model.material.uniforms.erosionParameters.value.x = p.erosion;
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
