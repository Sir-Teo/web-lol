import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { AhriRVisualHistory } from '../simulation/ahri-r-visual-history';
import { AHRI_R_VISUAL_HISTORY_TICKS } from '../content/ahri-r-visual-timing';
import { AhriRParticleSampler, AHRI_R_PROFILES as profiles } from './ahri-r-particles';
import { rVisualGroups, rVisualPose, rVisualKnown, type RVisualGroup } from './ahri-r-history';
import { ahriRAssets } from './ahri-r-assets';
import { RAttachmentRoots } from './ahri-r-attachments';
import type { MobileRig } from '../content/mobile-clip-durations';
import type { TargetPoseSampler } from './target-pose-sampler';
import { SourceParticleSurfaces } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { rTrailPoints } from './ahri-r-trails';
import { AhriRBuffParticles } from './ahri-r-buff-effects';
import { packedSourceTrailRibbon, type PackedTrailVertex } from './source-packed-trail-ribbon';
import { createRRibbonMaterial, rSoftParameters } from './ahri-r-ribbon-material';
import { AHRI_R_BOUND_SPELL_PROFILES, AHRI_R_SPELL_PROFILE_BINDINGS } from './ahri-r-particles';
export { loadAhriRAssets as loadAhriRParticles } from './ahri-r-assets';
const surfaceProfiles = profiles.map((p) => ({
  ...p,
  uvMode: 0,
  directionVelocityScale: p.directionVelocityScale ?? 0,
  soft: rSoftParameters(p.soft),
}));
export interface AhriRResources extends EclipseSurfaceAssets {
  sampler(rig: MobileRig): TargetPoseSampler;
}
type Ribbon = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
interface Held {
  record: AhriRVisualHistory;
  sampler: AhriRParticleSampler;
  particles: ReturnType<AhriRParticleSampler['sample']>;
}
/** Twenty-one spell profiles seek saved bolt/contact roots; two finite eye
 * profiles use the saved buff window. Other persistent producers stay deferred.
 * Missing global palette and native pixel calibration remain unverified. */
export class AhriRParticles {
  readonly models = new Map<string, Ribbon>();
  readonly surfaces: SourceParticleSurfaces<RVisualGroup>;
  readonly buffs: AhriRBuffParticles;
  readonly deferredProfiles = AHRI_R_SPELL_PROFILE_BINDINGS.filter(
    (p) => p.reason !== 'bound-spell-profile' && p.reason !== 'bound-buff-profile'
  );
  private attachments: RAttachmentRoots;
  get attachmentFallbacks() {
    return [...this.attachments.localFallbacks, ...this.buffs.attachmentFallbacks];
  }
  private groups: RVisualGroup[] = [];
  private held = new Map<string, Held>();
  private world?: World;
  private lastTick = -1;
  private eyeDirection = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: AhriRResources
  ) {
    this.attachments = new RAttachmentRoots(
      ground,
      supplied ? (rig) => supplied.sampler(rig) : undefined
    );
    this.buffs = new AhriRBuffParticles(scene, distortion, ground, supplied);
    this.surfaces = new SourceParticleSurfaces(scene, distortion, ground, {
      name: 'Ahri R projectile',
      attachment: 'saved-R-spell-root',
      profiles: surfaceProfiles,
      assets: () => this.supplied ?? ahriRAssets(),
      accepts: (i) => AHRI_R_BOUND_SPELL_PROFILES.includes(i) && profiles[i].kind !== 'trail',
      records: () =>
        this.groups.map((group) => ({
          sourceId: group.record.sourceId,
          castTick: group.startTick,
          group,
        })),
      particles: (g) => this.held.get(g.key)?.particles ?? [],
      birthVisible: () => true,
      visible: (g, p, tick, position) => {
        const team = this.world!.hero.team;
        const own = (g.role === 'flight' ? g.record.team : g.bolt.hit!.targetTeam) === team;
        if (own) return true;
        const bound = ((p as { sourceBind?: number }).sourceBind ?? 0) > 0;
        const known =
          g.role === 'flight' && bound
            ? rVisualKnown(g, Math.min(tick, this.world!.tick), team)
            : rVisualKnown(g, g.startTick + p.bornTick, team);
        return (
          known && this.world!.pointVisible({ x: position.x * 100, y: position.z * 100 }, team)
        );
      },
      pose: (g, tick) => {
        const pose = rVisualPose(g, tick),
          point = this.attachments.position(g, tick);
        return pose && point ? { x: point.x * 100, y: point.z * 100, facing: pose.facing } : null;
      },
      attachmentPoint: (g, tick) => this.attachments.position(g, tick),
      missileFrame: (g) => g.role === 'flight',
      particleFacing: (profile, born, current) => (profile.particleLocal ? current : born),
      sampledStretch: true,
    });
  }
  private create(index: number, assets: EclipseSurfaceAssets) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), createRRibbonMaterial(index, assets));
    mesh.frustumCulled = false;
    mesh.renderOrder = profiles[index].renderOrder;
    mesh.name = 'Ahri R ' + profiles[index].role + ' ' + profiles[index].name + ' ribbon';
    Object.assign(mesh.userData, {
      profileIndex: index,
      ownedGeometry: true,
      capacity: 0,
      attachment: 'saved-R-spell-root',
      sourceSmoothing: profiles[index].trail!.smoothing,
      sourceGroundLayer: profiles[index].ground,
      unboundPalette: !!profiles[index].palette && !profiles[index].palette!.texture,
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
        ['sourceCell', 2],
        ['sourceMultCell', 2],
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
      geometry.getAttribute('sourceCell').setXY(i, v.cell[0], v.cell[1]);
      geometry.getAttribute('sourceMultCell').setXY(i, v.multCell?.[0] ?? 0, v.multCell?.[1] ?? 0);
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
      this.attachments.dispose();
    }
    this.world = world;
    this.lastTick = world.tick;
    this.attachments.begin(world);
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    const assets = this.supplied ?? ahriRAssets(),
      active = new Set<string>(),
      keep = new Set<string>();
    this.groups = [];
    camera.getWorldDirection(this.eyeDirection);
    if (assets)
      for (const record of world.ahriRVisuals)
        for (const group of rVisualGroups(record)) {
          if (
            tick < group.startTick ||
            tick >=
              (group.role === 'hit' ? group.startTick : group.stopTick) +
                AHRI_R_VISUAL_HISTORY_TICKS
          )
            continue;
          keep.add(group.key);
          let held = this.held.get(group.key);
          if (!held || held.record !== record) {
            held?.sampler.dispose();
            held = {
              record,
              sampler: new AhriRParticleSampler(group.system, group.seed, {
                root: (time) => {
                  const at = group.startTick + time * 60,
                    pose = rVisualPose(group, at)!,
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
          const points = rTrailPoints(group, held.particles, this.ground, tick, world.hero.team);
          for (const index of new Set(points.map((p) => p.profileIndex))) {
            const p = profiles[index],
              trail = p.trail!;
            const known = points
              .filter((point) => point.profileIndex === index)
              .map((point) => ({
                ...point,
                visible:
                  point.visible &&
                  (record.team === world.hero.team ||
                    world.pointVisible(
                      { x: point.position[0], y: point.position[2] },
                      world.hero.team
                    )),
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
              rWindowStartTick: record.startTick,
              rBurstIndex: group.burst.index,
              rBoltIndex: group.bolt.index,
              groupKey: group.key,
              castTick: group.startTick,
              visiblePoints: known.filter((p) => p.visible).length,
            });
            active.add(key);
          }
        }
    this.surfaces.update(world, alpha, camera, terminalAge);
    this.buffs.update(world, alpha, camera, terminalAge);
    this.attachments.retain(keep);
    for (const [key, mesh] of this.models) if (!active.has(key)) this.release(key, mesh);
    for (const [key, held] of this.held)
      if (!keep.has(key)) {
        held.sampler.dispose();
        this.held.delete(key);
      }
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    const materials = [
      ...this.surfaces.models.values(),
      ...this.models.values(),
      ...this.buffs.surfaces.models.values(),
      ...this.buffs.models.values(),
    ]
      .map((mesh) => mesh.material)
      .filter((material) => material.uniforms.softDepth);
    if (!materials.length) {
      this.surfaces.depth.dispose();
      return;
    }
    const target = this.surfaces.depth.capture(renderer, this.scene, camera);
    for (const material of materials) {
      material.uniforms.softDepth.value = target.depthTexture;
      material.uniforms.softSize.value.set(target.width, target.height);
      material.uniforms.depthConversion.value.set(
        1 / camera.near,
        1 / camera.far - 1 / camera.near
      );
    }
  }
  private release(key: string, mesh: Ribbon) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
    this.models.delete(key);
  }
  dispose() {
    this.buffs.dispose();
    this.surfaces.dispose();
    for (const [key, mesh] of this.models) this.release(key, mesh);
    for (const held of this.held.values()) held.sampler.dispose();
    this.held.clear();
    this.groups = [];
    this.attachments.dispose();
    this.world = undefined;
    this.lastTick = -1;
  }
}
