import { primaryTrailExpiry, primaryTrailMarkerTick } from '../simulation/masteryi-primary-trails';
import type { UnitModel } from './models';
import * as THREE from 'three';
import data from '../content/masteryi-primary-trail-particles.json';
import type { MasterYiAttackAudio } from '../simulation/masteryi-aa-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { masterYiGeometry } from './masteryi-source-geometry';
import { masterYiTextures } from './masteryi-source-textures';
import { primaryTrailParticles } from './masteryi-primary-trail-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { actorRootKnown, actorRootPose } from '../simulation/actor-root-history';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
let geometry: THREE.BufferGeometry | undefined;
let pending: Promise<void> | undefined,
  ready = false;
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.colorSpace = THREE.NoColorSpace;
white.minFilter = white.magFilter = THREE.LinearFilter;
white.wrapS = white.wrapT = THREE.ClampToEdgeWrapping;
white.generateMipmaps = false;
white.needsUpdate = true;
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (!path) return white; // Explicit local neutral product for an omitted lookup.
    if (address !== 0 && address !== 2)
      throw RangeError('Unsupported primary trail texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing primary trail source texture');
    const wrap = address === 2 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (loaded.wrapS === wrap) return loaded;
    const key = `${path}:${address}`;
    let texture = samplers.get(key);
    if (!texture) {
      texture = loaded.clone();
      texture.wrapS = texture.wrapT = wrap;
      texture.needsUpdate = true;
      samplers.set(key, texture);
    }
    return texture;
  },
  mesh(path) {
    if (path !== data.mesh.url || !geometry) throw Error('Missing primary trail mesh');
    return geometry;
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadPrimaryTrails(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      ...data.textures
        .filter((asset) => !textures.has(asset.url))
        .map(async (asset) => {
          const lookup = data.profiles.some((profile) => profile.lookup === asset.url);
          const resource = await masterYiTextures.load(asset, lookup);
          textures.set(asset.url, resource);
        }),
      ...(geometry
        ? []
        : [
            (async () => {
              geometry = await masterYiGeometry.load(data.mesh);
            })(),
          ]),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
interface Group extends SurfaceGroup {
  record: MasterYiAttackAudio;
  unitId: number;
  profileIndex: number;
  terminalTick: number;
}
interface JointFrame {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}
export class PrimaryTrails extends SourceParticleSurfaces<Group> {
  private readonly frames: Map<number, JointFrame | null>;
  private readonly context: { models: ReadonlyMap<number, UnitModel> };
  constructor(scene: THREE.Scene, ground: (p: Vec2) => number) {
    const frames = new Map<number, JointFrame | null>(),
      context = { models: new Map<number, UnitModel>() as ReadonlyMap<number, UnitModel> },
      bones = new WeakMap<UnitModel, THREE.Object3D | null>();
    super(scene, scene, ground, {
      name: 'Primary trail',
      attachment: 'local-current-center-joint',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)!.masterYiAAAudio) {
            if (!record.trailFrames.length) continue;
            const markerTick = primaryTrailMarkerTick(record);
            if (
              markerTick > world.tick ||
              (record.cancelTick !== null && record.cancelTick <= markerTick) ||
              (unit.deadAt !== null && unit.deadAt <= markerTick)
            )
              continue;
            yield {
              sourceId: unit.id,
              castTick: record.startTick,
              group: {
                key: `${unit.id}:${record.startTick}`,
                startTick: markerTick,
                stopTick: primaryTrailExpiry(record),
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.startTick, 0x9e3779b9),
                record,
                unitId: unit.id,
                profileIndex: record.kind === 'attack1' ? 0 : record.kind === 'attack2' ? 1 : 2,
                terminalTick: world.winner ? world.tick : Infinity,
              },
            };
          }
        }
      },
      particles: (g, tick) =>
        primaryTrailParticles(g.seed, (tick - g.startTick) / 60, g.profileIndex),
      birthVisible: (g, born) =>
        actorRootKnown(g.record.trailFrames, Math.min(g.startTick + born, g.terminalTick), 'blue'),
      pose: (g, tick) => actorRootPose(g.record.trailFrames, tick),
      visible: (g, _p, tick) => actorRootKnown(g.record.trailFrames, tick, 'blue'),
      attachmentFrame: (g) => {
        if (frames.has(g.unitId)) return frames.get(g.unitId)!;
        const model = context.models.get(g.unitId);
        if (!model?.root.visible) {
          frames.set(g.unitId, null);
          return null;
        }
        let bone = bones.get(model);
        if (bone === undefined) {
          const name = data.markers[g.profileIndex].sourceBone.toLowerCase();
          let found: THREE.Object3D | null = null;
          model.root.traverse((node) => {
            if (node.name.toLowerCase() !== name) return;
            if (found) throw Error('Ambiguous primary trail joint');
            found = node;
          });
          bone = found;
          bones.set(model, bone);
        }
        if (!bone) {
          frames.set(g.unitId, null);
          return null;
        }
        const frame = {
          position: bone.getWorldPosition(new THREE.Vector3()),
          rotation: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
        };
        frames.set(g.unitId, frame);
        return frame;
      },
    });
    this.frames = frames;
    this.context = context;
  }
  updateAttached(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    models: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    this.frames.clear();
    this.context.models = models;
    super.update(world, alpha, camera, terminalAge);
  }
}
