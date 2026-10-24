import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { animationLayers } from '../simulation/animation-timeline';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { createTargetPoseSampler } from './models';
import type { TargetPoseSampler } from './target-pose-sampler';
import { createParticleSkinMultMaterial } from './particle-skin-mult-material';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { SOLAR_PROFILES, solarParticles } from './leona-solar-particles';
import { solarBirthFrame, solarDrawGroups } from './leona-solar-history';
import { zenithPoseAt } from './leona-zenith-history';

export interface SolarSkinResources {
  texture(path: string, address: number): THREE.Texture;
  sampler(): TargetPoseSampler;
}
interface SkinInstance {
  root: THREE.Group;
  sampler: TargetPoseSampler;
  material: THREE.ShaderMaterial;
  meshes: THREE.SkinnedMesh[];
}
let resources: SolarSkinResources | undefined, pending: Promise<void> | undefined;
const key = (path: string, address: number) => `${path}:${address}`;
export function loadLeonaSolarSkins(): Promise<void> {
  return (pending ??= (async () => {
    const profiles = SOLAR_PROFILES.filter((p) => p.kind === 'skin'),
      images = await loadLuxParticleTextures(
        profiles.flatMap((p) => [p.texture!, p.multiplier!.texture])
      ),
      textures = new Map<string, THREE.Texture>();
    for (const p of profiles)
      for (const [path, address] of [
        [p.texture!, p.uv.address],
        [p.multiplier!.texture, p.multiplier!.uv.address],
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

/** The authored R weapon mask overlays a private complete posed owner skin.
 * Source texture/multiplier/scale are retained. Zero rim, no-FOW, optional global
 * remap bypass, 5/255 alpha test and saved-root dispatch remain local bindings. */
export class LeonaSolarSkins {
  readonly models = new Map<string, SkinInstance>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: SolarSkinResources
  ) {}
  private create(profileIndex: number) {
    const p = SOLAR_PROFILES[profileIndex],
      images = this.supplied ?? resources!;
    if (
      p.kind !== 'skin' ||
      !p.texture ||
      !p.multiplier ||
      p.lookup ||
      p.reflection ||
      p.erosion ||
      !p.lockMeshToAttachment ||
      p.blend !== 4
    )
      throw Error('Unsupported Solar attached-skin material');
    const material = createParticleSkinMultMaterial({
      texture: images.texture(p.texture, p.uv.address),
      multiplier: images.texture(p.multiplier.texture, p.multiplier.uv.address),
      fresnel: 1,
      fresnelColor: [0, 0, 0],
      alphaRef: p.alphaRef,
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
          throw Error('Solar source character has an unskinned submesh');
        if (!node.geometry.getAttribute('normal'))
          throw Error('Solar source character requires its authored normal stream');
        node.material = material;
        node.frustumCulled = false;
        node.castShadow = node.receiveShadow = false;
        node.renderOrder = p.renderOrder;
        meshes.push(node);
      });
      if (!meshes.length) throw Error('Solar source character has no skinned mesh');
    } catch (error) {
      sampler?.dispose();
      material.dispose();
      throw error;
    }
    root.name = `Leona R ${p.name}`;
    this.scene.add(root);
    return { root, sampler, material, meshes };
  }
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (this.supplied || resources)
      for (const unit of world.units) {
        const state = world.championState(unit.id);
        if (!state?.leonaRVisuals.length) continue;
        for (const r of state.leonaRVisuals)
          for (const group of solarDrawGroups(unit.id, unit.team, r)) {
            if (group.role !== 'buff') continue;
            const pose = zenithPoseAt(group.frames, tick);
            if (!pose || !world.pointVisible(pose)) continue;
            for (const p of solarParticles(
              group.role,
              group.seed,
              (tick - group.startTick) / 60,
              (group.stopTick - group.startTick) / 60,
              group.radius
            )) {
              const profile = SOLAR_PROFILES[p.profileIndex];
              if (profile.kind !== 'skin' || !solarBirthFrame(group, p.bornTick, !!world.winner))
                continue;
              const id = `${group.key}:${p.profileIndex}:${p.ordinal}`;
              let model = this.models.get(id);
              if (!model) this.models.set(id, (model = this.create(p.profileIndex)));
              active.add(id);
              model.root.position.set(pose.x * 0.01, this.ground(pose), pose.y * 0.01);
              model.root.rotation.y = pose.facing;
              model.root.scale.fromArray(p.size);
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
              if (!p.multUv) throw Error('Solar skin requires an explicit multiplier UV');
              const mult = p.multUv;
              model.material.uniforms.multiplierUvTransform.value.set(
                mult.scale[0] * mult.cellSize[0],
                0,
                ((1 - mult.scale[0]) * 0.5 + mult.offset[0]) * mult.cellSize[0] + mult.cell[0],
                0,
                mult.scale[1] * mult.cellSize[1],
                ((1 - mult.scale[1]) * 0.5 + mult.offset[1]) * mult.cellSize[1] + mult.cell[1],
                0,
                0,
                1
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
                lockMeshToAttachment: profile.lockMeshToAttachment,
                attachment: 'saved-owner-skin',
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
