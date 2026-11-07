import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { AhriEVisualHistory } from '../simulation/ahri-e-visual-history';
import { AHRI_E_VISUAL_HISTORY_TICKS } from '../content/ahri-e-visual-timing';
import { AhriEParticleSampler, AHRI_E_PROFILES as profiles } from './ahri-e-particles';
import { eVisualGroups, eVisualPose, eVisualKnown, type EVisualGroup } from './ahri-e-history';
import { ahriEAssets } from './ahri-e-assets';
import { EAttachmentRoots } from './ahri-e-attachments';
import { AhriECastSkins } from './ahri-e-cast-skins';
import { AHRI_E_SKIN_BINDINGS } from './ahri-e-skin-bindings';
import type { MobileRig } from '../content/mobile-clip-durations';
import type { TargetPoseSampler } from './target-pose-sampler';
import { SourceParticleSurfaces } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { eTrailPoints } from './ahri-e-trails';
import { packedSourceTrailRibbon, type PackedTrailVertex } from './source-packed-trail-ribbon';
import { createERibbonMaterial } from './ahri-e-ribbon-material';
export { loadAhriEAssets as loadAhriEParticles } from './ahri-e-assets';
function softParameters(
  soft: { beginIn?: number; deltaIn?: number; beginOut?: number; deltaOut?: number } | null
) {
  return soft
    ? {
        beginIn: soft.beginIn ?? 0,
        deltaIn: soft.deltaIn ?? 0,
        beginOut: soft.beginOut ?? 0,
        deltaOut: soft.deltaOut ?? 0,
      }
    : null;
}
const surfaceProfiles = profiles.map((p) => ({
  ...p,
  uvMode: 0,
  directionVelocityScale: 0,
  soft: softParameters(p.soft),
}));
export interface AhriEResources extends EclipseSurfaceAssets {
  sampler(rig: MobileRig): TargetPoseSampler;
}
type Ribbon = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
interface Held {
  record: AhriEVisualHistory;
  sampler: AhriEParticleSampler;
  particles: ReturnType<AhriEParticleSampler['sample']>;
}
/** Cast, flight, contact and persistent-buff effects seek saved roots.
 * Named attachment fallbacks, source-size flex and cosmetic draws are local adapters.
 * Buff Avatar selection remains unresolved; native pixel equivalence is unverified. */
export class AhriEParticles {
  readonly models = new Map<string, Ribbon>();
  readonly surfaces: SourceParticleSurfaces<EVisualGroup>;
  readonly castSkins: AhriECastSkins;
  readonly unboundSkinProfiles = AHRI_E_SKIN_BINDINGS.filter(
    (p) => p.selectorPolicy === 'unresolved-omission'
  ).map((p) => p.profileIndex);
  private attachments: EAttachmentRoots;
  get attachmentFallbacks() {
    return this.attachments.localFallbacks;
  }
  private groups: EVisualGroup[] = [];
  private held = new Map<string, Held>();
  private world?: World;
  private lastTick = -1;
  private eyeDirection = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: AhriEResources
  ) {
    this.attachments = new EAttachmentRoots(
      ground,
      supplied ? (rig) => supplied.sampler(rig) : undefined
    );
    this.castSkins = new AhriECastSkins(
      scene,
      ground,
      supplied ? () => supplied.sampler('ahri-base') : undefined
    );
    this.surfaces = new SourceParticleSurfaces(scene, distortion, ground, {
      name: 'Ahri E projectile',
      attachment: 'saved-E-phase-root',
      profiles: surfaceProfiles,
      assets: () => this.supplied ?? ahriEAssets(),
      accepts: (i) => profiles[i].kind !== 'skin' && profiles[i].kind !== 'trail',
      records: () =>
        this.groups.map((group) => ({
          sourceId: group.record.sourceId,
          castTick: group.startTick,
          group,
        })),
      particles: (g) => this.held.get(g.key)?.particles ?? [],
      birthVisible: () => true,
      visible: (g, p, tick, position) => {
        const own =
          g.role === 'cast' || g.role === 'flight'
            ? g.record.team === 'blue'
            : g.record.hit?.targetTeam === 'blue';
        if (own) return true;
        const bound = (p as { sourceBind?: number }).sourceBind === 1;
        const known =
          (g.role === 'flight' || g.role === 'buff') && bound
            ? eVisualKnown(g, Math.min(tick, this.world!.tick))
            : eVisualKnown(g, g.startTick + p.bornTick);
        return (
          known && this.world!.pointVisible({ x: position.x * 100, y: position.z * 100 }, 'blue')
        );
      },
      pose: (g, tick) => {
        const pose = eVisualPose(g, tick),
          point = this.attachments.position(g, tick);
        return pose && point ? { x: point.x * 100, y: point.z * 100, facing: pose.facing } : null;
      },
      attachmentPoint: (g, tick) => this.attachments.position(g, tick),
      missileFrame: (g) => g.role === 'flight',
      particleFacing: (profile, born, current) => (profile.particleLocal ? current : born),
      vertexColor: (i) => (profiles[i].kind === 'ray' ? 'bgra-unorm8' : undefined),
      sampledStretch: true,
    });
  }
  private create(index: number, assets: EclipseSurfaceAssets) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), createERibbonMaterial(index, assets));
    mesh.frustumCulled = false;
    mesh.renderOrder = profiles[index].renderOrder;
    mesh.name = 'Ahri E ' + profiles[index].role + ' ' + profiles[index].name + ' ribbon';
    Object.assign(mesh.userData, {
      profileIndex: index,
      ownedGeometry: true,
      capacity: 0,
      attachment: 'saved-E-phase-root',
      sourceSmoothing: profiles[index].trail!.smoothing,
    });
    this.scene.add(mesh);
    return mesh;
  }
  private write(mesh: Ribbon, vertices: readonly PackedTrailVertex[]) {
    let geometry = mesh.geometry;
    if (mesh.userData.capacity < vertices.length) {
      geometry.dispose();
      geometry = mesh.geometry = new THREE.BufferGeometry();
      const capacity = Math.max(24, 2 ** Math.ceil(Math.log2(vertices.length)));
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['sourceTint', 4],
        ['sourceLookup', 2],
        ['sourceErosion', 1],
        ['sourceMultUv', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      mesh.userData.capacity = capacity;
    }
    const box = new THREE.Box3(),
      point = new THREE.Vector3();
    vertices.forEach((v, i) => {
      point.fromArray(v.position).multiplyScalar(0.01);
      box.expandByPoint(point);
      geometry.getAttribute('position').setXYZ(i, point.x, point.y, point.z);
      geometry.getAttribute('uv').setXY(i, v.uv[0], v.uv[1]);
      geometry
        .getAttribute('sourceTint')
        .setXYZW(i, v.color[0], v.color[1], v.color[2], v.color[3]);
      geometry.getAttribute('sourceLookup').setXY(i, v.lookup[0], v.lookup[1]);
      geometry.getAttribute('sourceErosion').setX(i, v.erosion);
      geometry.getAttribute('sourceMultUv').setXY(i, v.multUv?.[0] ?? 0, v.multUv?.[1] ?? 0);
    });
    for (const attr of Object.values(geometry.attributes)) attr.needsUpdate = true;
    geometry.setDrawRange(0, vertices.length);
    box.getBoundingSphere((geometry.boundingSphere ??= new THREE.Sphere()));
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (this.world !== world || world.tick < this.lastTick) {
      this.surfaces.dispose();
      for (const [key, mesh] of this.models) this.release(key, mesh);
      for (const held of this.held.values()) held.sampler.dispose();
      this.held.clear();
      this.castSkins.dispose();
      this.attachments.dispose();
    }
    this.world = world;
    this.lastTick = world.tick;
    this.attachments.begin(world);
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    const assets = this.supplied ?? ahriEAssets(),
      active = new Set<string>(),
      keep = new Set<string>();
    this.groups = [];
    camera.getWorldDirection(this.eyeDirection);
    if (assets)
      for (const record of world.ahriEVisuals)
        for (const group of eVisualGroups(record)) {
          if (
            tick < group.startTick ||
            tick >=
              (group.role === 'hit' || group.role === 'cast' ? group.startTick : group.stopTick) +
                AHRI_E_VISUAL_HISTORY_TICKS
          )
            continue;
          keep.add(group.key);
          let held = this.held.get(group.key);
          if (!held || held.record !== record) {
            held?.sampler.dispose();
            held = {
              record,
              sampler: new AhriEParticleSampler(group.system, group.seed, {
                root: (time) => {
                  const at = group.startTick + time * 60,
                    pose = eVisualPose(group, at)!,
                    point = this.attachments.position(group, at)!;
                  return {
                    x: point.x * 100,
                    y: point.z * 100,
                    height: point.y * 100,
                    facing: pose.facing,
                  };
                },
                boundObjectSize: group.radius * 2,
              }),
              particles: [],
            };
            this.held.set(group.key, held);
          }
          held.particles = held.sampler.sample(
            (tick - group.startTick) / 60,
            (group.stopTick - group.startTick) / 60
          );
          this.groups.push(group);
          const points = eTrailPoints(group, held.particles, this.ground);
          for (const index of new Set(points.map((p) => p.profileIndex))) {
            const p = profiles[index],
              trail = p.trail!;
            const known = points
              .filter((point) => point.profileIndex === index)
              .map((point) => ({
                ...point,
                visible:
                  point.visible &&
                  (record.team === 'blue' ||
                    world.pointVisible({ x: point.position[0], y: point.position[2] }, 'blue')),
              }));
            const vertices = packedSourceTrailRibbon(
              known,
              trail.cutoff ?? 0,
              trail.cameraFacing ? this.eyeDirection.toArray() : null,
              (trail.smoothing ?? 0) as 0 | 1 | 2
            );
            if (!vertices.length) continue;
            const key = group.key + ':' + index;
            let mesh = this.models.get(key);
            if (!mesh) this.models.set(key, (mesh = this.create(index, assets)));
            this.write(mesh, vertices);
            Object.assign(mesh.userData, {
              sourceId: record.sourceId,
              eCastTick: record.castTick,
              groupKey: group.key,
              castTick: group.startTick,
              visiblePoints: known.filter((p) => p.visible).length,
            });
            active.add(key);
          }
        }
    this.surfaces.update(world, alpha, camera, terminalAge);
    if (assets)
      this.castSkins.update(
        world,
        tick,
        this.groups.map((group) => ({ group, particles: this.held.get(group.key)!.particles })),
        assets
      );
    this.attachments.retain(keep);
    for (const [key, mesh] of this.models) if (!active.has(key)) this.release(key, mesh);
    for (const [key, held] of this.held)
      if (!keep.has(key)) {
        held.sampler.dispose();
        this.held.delete(key);
      }
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.surfaces.prepareDepth(renderer, camera);
  }
  private release(key: string, mesh: Ribbon) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
    this.models.delete(key);
  }
  dispose() {
    this.surfaces.dispose();
    for (const [key, mesh] of this.models) this.release(key, mesh);
    for (const held of this.held.values()) held.sampler.dispose();
    this.held.clear();
    this.groups = [];
    this.castSkins.dispose();
    this.attachments.dispose();
    this.world = undefined;
    this.lastTick = -1;
  }
}
