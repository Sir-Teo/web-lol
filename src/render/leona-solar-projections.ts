import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { SOLAR_PROFILES, solarParticles } from './leona-solar-particles';
import { solarBirthFrame, solarDrawGroups } from './leona-solar-history';
import { solarProjectionFrame } from './leona-solar-projection-frame';
import { solarProjectionAssets, type SolarProjectionAssets } from './leona-solar-projection-assets';
import { ParticleDecalReceivers } from './particle-decal-receivers';
import { createParticleDecalMaterial } from './particle-decal-material';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
export { loadLeonaSolarProjections } from './leona-solar-projection-assets';

/** Local terrain eligibility/clipping/projector matrices feed native-derived
 * UNLIT_DECAL arithmetic. Actual16.18 CPU dispatch/state/bindings remain open. */
export class LeonaSolarProjections {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private receivers: ParticleDecalReceivers,
    private supplied?: SolarProjectionAssets
  ) {}
  update(world: World, alpha: number, terminalAge = 0) {
    const assets = this.supplied ?? solarProjectionAssets(),
      active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (assets)
      for (const source of world.units) {
        const state = world.championState(source.id);
        if (!state?.leonaRVisuals.length) continue;
        for (const r of state.leonaRVisuals)
          for (const group of solarDrawGroups(source.id, source.team, r)) {
            if (!group.role.startsWith('area-') || !group.origin) continue;
            for (const p of solarParticles(
              group.role,
              group.seed,
              (tick - group.startTick) / 60,
              Infinity,
              group.radius
            )) {
              const profile = SOLAR_PROFILES[p.profileIndex];
              if (
                profile.kind !== 'projection' ||
                !solarBirthFrame(group, p.bornTick, !!world.winner)
              )
                continue;
              if (
                !profile.projection ||
                !profile.texture ||
                !profile.lookup ||
                profile.local ||
                p.orbitalVelocity.some((v) => v !== 0)
              )
                throw Error('Unsupported Solar projector binding');
              const center: [number, number, number] = [
                (group.origin.x - p.offset[0] - p.accelerationOffset[0]) * 0.01,
                this.ground(group.origin) + (p.offset[1] + p.accelerationOffset[1]) * 0.01,
                (group.origin.y + p.offset[2] + p.accelerationOffset[2]) * 0.01,
              ];
              if (!world.pointVisible({ x: center[0] * 100, y: center[2] * 100 })) continue;
              const frame = solarProjectionFrame(p, center, profile.projection),
                id = `${group.key}:${p.profileIndex}:${p.ordinal}`;
              let model = this.models.get(id);
              const geometry = model?.geometry ?? new THREE.BufferGeometry(),
                stats = this.receivers.write(geometry, frame.footprint);
              if (!model) {
                if (!stats.corners) {
                  geometry.dispose();
                  continue;
                }
                const material = createParticleDecalMaterial(geometry, {
                  // The retained16.18 UNLIT_DECAL CPU path overrides all three
                  // sampler address axes to clamp, independently of source UV mode.
                  diffuse: assets.texture(profile.texture, 2),
                  lookup: assets.texture(profile.lookup, 2),
                  world: new THREE.Matrix4(),
                  worldToUv: stats.mapping,
                  heightRange: frame.heightRange,
                  color: [1, 1, 1, 1],
                  lookupUv: [0.5, 0.5],
                });
                Object.assign(material, {
                  blending: THREE.CustomBlending,
                  blendEquation: THREE.AddEquation,
                  blendSrc: profile.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
                  blendDst: profile.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
                  depthTest: (profile.miscRenderFlags & 1) === 0,
                  depthWrite: false,
                });
                groundEffectMaterial(material);
                model = new THREE.Mesh(geometry, material);
                model.name = `Leona R ${profile.role} ${profile.name}`;
                model.frustumCulled = false;
                model.renderOrder = profile.renderOrder;
                setGroundRenderStage(model, 'ground');
                this.scene.add(model);
                this.models.set(id, model);
              }
              active.add(id);
              const uniforms = model.material.uniforms,
                color = [...p.color];
              if (profile.blend === 0) for (let i = 0; i < 3; i++) color[i] *= color[3];
              uniforms.worldToUv.value.copy(stats.mapping);
              uniforms.heightRange.value.fromArray(frame.heightRange);
              uniforms.particleColor.value.fromArray(color);
              uniforms.lookupUv.value.fromArray(p.lookup);
              Object.assign(model.userData, {
                sourceId: source.id,
                castTick: r.startTick,
                profileIndex: p.profileIndex,
                role: group.role,
                ordinal: p.ordinal,
                bornTick: group.startTick + p.bornTick,
                phase: p.phase,
                receiverCorners: stats.corners,
                receiverCandidates: stats.candidates,
                receiverTriangles: stats.sourceTriangles,
                attachment: 'saved-fixed-area-receivers',
              });
            }
          }
      }
    for (const [id, model] of this.models) if (!active.has(id)) this.retire(id, model);
  }
  private retire(id: string, model: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>) {
    model.removeFromParent();
    model.geometry.dispose();
    model.material.dispose();
    this.models.delete(id);
  }
  dispose() {
    for (const [id, model] of this.models) this.retire(id, model);
  }
}
