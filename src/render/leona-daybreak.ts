import * as THREE from 'three';
import profiles from '../content/leona-q-particles.json';
import { LEONA_Q_SHIELD_BONE, LEONA_Q_HIT_BONE } from '../content/leona-q-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { createTargetPoseSampler } from './models';
import { ImpactAttachments, type AttachmentHistory } from './impact-attachments';
import { createParticleColorProductMaterial } from './particle-color-product';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { daybreakParticles } from './leona-q-particles';
import { projectGroundQuad } from './ground-quad';
import { maskGroundWalkability } from './ground-walkability-mask';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import type { DaybreakFrame } from '../simulation/leona-q-visuals';

let textures: Map<string, THREE.Texture> | undefined;
export async function loadLeonaDaybreak() {
  textures = await loadLuxParticleTextures(
    profiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])])
  );
}
const billboard = new THREE.PlaneGeometry(2, 2),
  quad = new THREE.PlaneGeometry(2, 2);
for (let i = 0; i < 4; i++) {
  const b = billboard.getAttribute('uv');
  b.setY(i, 1 - b.getY(i));
  const q = quad.getAttribute('uv'),
    u = q.getX(i),
    v = q.getY(i);
  q.setXY(i, v, 1 - u);
}
/** Shield and target-centre attachments are explicit local choices. Saved poses
 * and per-birth audiences survive reload/death without consulting a later pose. */
export class LeonaDaybreak {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private paths = new Map<string, ImpactAttachments>();
  private worldUp = new THREE.Vector3(0, 1, 0);
  private rollAxis = new THREE.Vector3(0, 0, 1);
  private roll = new THREE.Quaternion();
  private rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    const active = new Set<string>(),
      usedPaths = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (textures)
      for (const unit of world.units) {
        const state = world.championState(unit.id);
        if (!state?.leonaQVisuals.length) continue;
        for (const r of state.leonaQVisuals) {
          const base = `${unit.id}:${r.startTick}`;
          const groups: [
            string,
            'cast' | 'hit',
            number,
            number,
            number,
            AttachmentHistory,
            DaybreakFrame[],
            string,
          ][] = [
            [
              base + ':cast',
              'cast',
              r.startTick,
              r.stopTick ?? Infinity,
              unit.radius,
              { critical: false, targetTransform: null, targetRig: 'leona-base', frames: r.frames },
              r.frames,
              LEONA_Q_SHIELD_BONE,
            ],
          ];
          if (r.impact?.audience.includes('blue')) {
            const h = r.impact;
            groups.push([
              base + ':hit',
              'hit',
              h.tick,
              Infinity,
              h.radius,
              {
                critical: false,
                targetTransform: h.targetTransform,
                targetRig: h.targetRig,
                frames: h.frames,
              },
              h.frames,
              LEONA_Q_HIT_BONE,
            ]);
          }
          for (const [key, role, start, stop, radius, history, frames, bone] of groups) {
            const particles = daybreakParticles(
              role,
              unit.id ^ Math.imul(r.startTick, 0x9e3779b9),
              (tick - start) / 60,
              (stop - start) / 60,
              radius
            );
            if (!particles.length) continue;
            let path = this.paths.get(key);
            if (!path) {
              path = new ImpactAttachments(
                history.targetRig
                  ? createTargetPoseSampler(
                      history.targetRig as Parameters<typeof createTargetPoseSampler>[0]
                    )
                  : null,
                this.ground,
                () => bone
              );
              this.paths.set(key, path);
            }
            usedPaths.add(key);
            for (const p of particles) {
              const born = frames[Math.min(frames.length - 1, p.bornTick)];
              if (born.tick !== start + p.bornTick || !born.audience.includes('blue')) continue;
              const profile = profiles[p.profileIndex],
                at = p.bind === 1 ? tick : start + p.bornTick;
              const center = path.point(history, at),
                facing = profile.local ? born.facing : 0;
              const offset = new THREE.Vector3(-p.offset[0], p.offset[1], p.offset[2])
                .multiplyScalar(0.01)
                .applyAxisAngle(this.worldUp, facing);
              const position = center.clone().add(offset);
              if (!world.pointVisible({ x: position.x * 100, y: position.z * 100 })) continue;
              const id = `${key}:${p.profileIndex}:${p.ordinal}`;
              active.add(id);
              let mesh = this.models.get(id);
              if (!mesh) {
                const material = createParticleColorProductMaterial(
                  textures.get(profile.texture)!,
                  textures.get(profile.lookup ?? '')!
                );
                Object.assign(material, {
                  transparent: true,
                  depthWrite: false,
                  depthTest: (profile.miscRenderFlags & 1) === 0,
                  blending: THREE.CustomBlending,
                  blendEquation: THREE.AddEquation,
                  blendSrc: profile.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
                  blendDst: profile.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
                });
                const owned = profile.ground || profile.terrain;
                mesh = new THREE.Mesh(
                  owned ? new THREE.BufferGeometry() : profile.kind === 'quad' ? quad : billboard,
                  material
                );
                Object.assign(mesh.userData, {
                  ownedGeometry: owned,
                  profileIndex: p.profileIndex,
                  role,
                  sourceId: unit.id,
                  castTick: r.startTick,
                  bone,
                });
                if (owned) {
                  groundEffectMaterial(material);
                  setGroundRenderStage(mesh, 'ground');
                }
                mesh.frustumCulled = false;
                mesh.name = `Leona Q ${profile.role} ${profile.name}`;
                mesh.renderOrder = profile.renderOrder;
                this.models.set(id, mesh);
                this.scene.add(mesh);
              }
              if (profile.ground || profile.terrain) {
                const origin = { x: born.x, y: born.y };
                projectGroundQuad(
                  mesh.geometry,
                  {
                    origin,
                    target: { x: origin.x + Math.sin(facing), y: origin.y + Math.cos(facing) },
                    offset: p.offset,
                    halfSize: p.size,
                    rotation: p.rotation,
                  },
                  (q) => this.ground(q) * 100,
                  10,
                  2
                );
                if (profile.navmesh)
                  maskGroundWalkability(mesh.geometry, (q) =>
                    world.battlefield.lineWalkable(q, q, 0)
                  );
              } else {
                mesh.position.copy(position);
                if (profile.kind === 'billboard')
                  mesh.quaternion
                    .copy(camera.quaternion)
                    .multiply(
                      this.roll.setFromAxisAngle(this.rollAxis, (p.rotation[0] * Math.PI) / 180)
                    );
                else {
                  this.rotation.set(
                    (p.rotation[0] * Math.PI) / 180,
                    (p.rotation[1] * Math.PI) / 180,
                    (p.rotation[2] * Math.PI) / 180,
                    'YXZ'
                  );
                  mesh.quaternion.setFromEuler(this.rotation);
                }
                mesh.scale.set(p.size[0] * 0.01, p.size[1] * 0.01, 1);
              }
              mesh.material.uniforms.particleColor.value.fromArray(p.color);
              mesh.material.uniforms.lookupUv.value.fromArray(p.lookup);
              Object.assign(mesh.userData, {
                age: p.age,
                bornTick: start + p.bornTick,
                phase: p.phase,
              });
            }
          }
        }
      }
    for (const [key, m] of this.models)
      if (!active.has(key)) {
        this.scene.remove(m);
        m.material.dispose();
        if (m.userData.ownedGeometry) m.geometry.dispose();
        this.models.delete(key);
      }
    for (const [key, path] of this.paths)
      if (!usedPaths.has(key)) {
        path.dispose();
        this.paths.delete(key);
      }
  }
}
