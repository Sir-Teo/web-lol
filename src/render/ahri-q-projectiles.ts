import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { AhriQProjectileVisual } from '../simulation/ahri-q-projectile-visuals';
import { AHRI_Q_PROJECTILE_HISTORY_TICKS } from '../content/ahri-q-projectile-timing';
import {
  AhriQProjectileSampler,
  AHRI_Q_PROJECTILE_PROFILES as profiles,
} from './ahri-q-projectile-particles';
import {
  qProjectileGroups,
  qProjectilePose,
  qProjectileKnown,
  QProjectilePath,
  type QProjectileGroup,
} from './ahri-q-projectile-history';
import { ahriQProjectileAssets } from './ahri-q-projectile-assets';
import { SourceParticleSurfaces } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { qProjectileTrailPoints } from './ahri-q-projectile-trails';
import { packedSourceTrailRibbon, type PackedTrailVertex } from './source-packed-trail-ribbon';
import { createQProjectileRibbonMaterial } from './ahri-q-projectile-ribbon-material';
export { loadAhriQProjectileAssets as loadAhriQProjectiles } from './ahri-q-projectile-assets';
type Ribbon = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
interface Held {
  record: AhriQProjectileVisual;
  sampler: AhriQProjectileSampler;
  path: QProjectilePath;
  particles: ReturnType<AhriQProjectileSampler['sample']>;
}
/** Two explicitly dispatched finite source systems, seeked from saved roots.
 * Current visibility admits bound enemy cores after hidden launches; unbound
 * births and ribbons retain historical fog separators. Native script dispatch,
 * constructor defaults and pixel/device equivalence remain unverified. */
export class AhriQProjectiles {
  readonly models = new Map<string, Ribbon>();
  readonly surfaces: SourceParticleSurfaces<QProjectileGroup>;
  private groups: QProjectileGroup[] = [];
  private held = new Map<string, Held>();
  private world?: World;
  private lastTick = -1;
  private eyeDirection = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private supplied?: EclipseSurfaceAssets
  ) {
    this.surfaces = new SourceParticleSurfaces(scene, distortion, ground, {
      name: 'Ahri Q projectile',
      attachment: 'saved-missile-root',
      profiles,
      assets: () => this.supplied ?? ahriQProjectileAssets(),
      accepts: (i) => profiles[i].kind !== 'trail',
      records: () =>
        this.groups.map((group) => ({
          sourceId: group.record.sourceId,
          castTick: group.startTick,
          group,
        })),
      particles: (g) => this.held.get(g.key)?.particles ?? [],
      birthVisible: () => true,
      visible: (g, p, _tick, position) => {
        if (g.record.team === 'blue') return true;
        return (
          (p.bind === 1 || qProjectileKnown(g.record, g.startTick + p.bornTick)) &&
          this.world!.pointVisible({ x: position.x * 100, y: position.z * 100 }, 'blue')
        );
      },
      pose: (g, tick) => qProjectilePose(g.record, tick),
      attachmentPoint: (g, tick) => {
        const p = qProjectilePose(g.record, tick);
        return p ? new THREE.Vector3(p.x * 0.01, ground(p) + 0.9, p.y * 0.01) : null;
      },
      missileFrame: () => true,
    });
  }
  private create(index: number, assets: EclipseSurfaceAssets) {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      createQProjectileRibbonMaterial(index, assets)
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = profiles[index].renderOrder;
    mesh.name = 'Ahri Q ' + profiles[index].role + ' ' + profiles[index].name + ' ribbon';
    Object.assign(mesh.userData, {
      profileIndex: index,
      ownedGeometry: true,
      capacity: 0,
      attachment: 'saved-missile-root',
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
    }
    this.world = world;
    this.lastTick = world.tick;
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    const assets = this.supplied ?? ahriQProjectileAssets(),
      active = new Set<string>(),
      keep = new Set<string>();
    this.groups = [];
    camera.getWorldDirection(this.eyeDirection);
    if (assets)
      for (const record of world.ahriQProjectileVisuals)
        for (const group of qProjectileGroups(record)) {
          if (tick < group.startTick || tick >= group.stopTick + AHRI_Q_PROJECTILE_HISTORY_TICKS)
            continue;
          keep.add(group.key);
          let held = this.held.get(group.key);
          if (!held || held.record !== record) {
            held?.sampler.dispose();
            held = {
              record,
              sampler: new AhriQProjectileSampler(group.role, group.seed),
              path: new QProjectilePath(record),
              particles: [],
            };
            this.held.set(group.key, held);
          }
          held.particles = held.sampler.sample(
            (tick - group.startTick) / 60,
            (group.stopTick - group.startTick) / 60
          );
          this.groups.push(group);
          const points = qProjectileTrailPoints(group, held.particles, held.path, this.ground);
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
              orbId: record.id,
              groupKey: group.key,
              castTick: group.startTick,
              visiblePoints: known.filter((p) => p.visible).length,
            });
            active.add(key);
          }
        }
    this.surfaces.update(world, alpha, camera, terminalAge);
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
    this.world = undefined;
    this.lastTick = -1;
  }
}
