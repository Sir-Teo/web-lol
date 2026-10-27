import { HIGHLANDER_CAST_HISTORY_TICKS } from '../content/masteryi-r-cast-timing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/masteryi-r-cast-particles.json';
import type { HighlanderCastVisual } from '../simulation/masteryi-highlander-cast';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { checkedAssetBytes } from './authored-mip-texture';
import { masterYiTextures } from './masteryi-source-textures';
import { highlanderCastParticles } from './masteryi-r-cast-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { actorRootKnown, actorRootPose } from '../simulation/actor-root-history';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
const geometries = new Map<string, THREE.BufferGeometry>();
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
    if (address !== 0 && address !== 2) throw RangeError('Unsupported Highlander texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Highlander source texture');
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
    const geometry = geometries.get(path);
    if (!geometry) throw Error('Missing Highlander source mesh');
    return geometry;
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadHighlanderCasts(): Promise<void> {
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
      ...data.meshes
        .filter((asset) => !geometries.has(asset.url))
        .map(async (asset) => {
          const raw = await checkedAssetBytes(asset.url, asset.output.bytes, asset.output.sha256),
            gltf = await new GLTFLoader().parseAsync(raw, import.meta.env.BASE_URL),
            found: THREE.BufferGeometry[] = [];
          gltf.scene.updateMatrixWorld(true);
          let transformed = false;
          gltf.scene.traverse((node) => {
            if (!(node instanceof THREE.Mesh)) return;
            transformed ||= !node.matrixWorld.equals(new THREE.Matrix4());
            found.push(node.geometry);
            for (const material of Array.isArray(node.material) ? node.material : [node.material])
              material.dispose();
          });
          if (found.length !== 1 || transformed) {
            found.forEach((g) => g.dispose());
            throw Error('Invalid Highlander mesh closure/transform');
          }
          geometries.set(asset.url, found[0]);
        }),
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
  record: HighlanderCastVisual;
}
export class HighlanderCasts extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, early: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, early, ground, {
      name: 'Highlander',
      attachment: 'actor-root',
      distortionTarget(index) {
        if (data.profiles[index].distortion?.mode !== 2)
          throw Error('Unsupported Highlander distortion phase');
        return early;
      },
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.highlanderCastVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.startTick,
              group: {
                key: `${unit.id}:${record.startTick}`,
                startTick: record.startTick,
                stopTick: record.startTick + HIGHLANDER_CAST_HISTORY_TICKS,
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.startTick, 0x9e3779b9),
                record,
              },
            };
        }
      },
      particles: (group, tick) =>
        highlanderCastParticles(group.seed, (tick - group.startTick) / 60),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') &&
        actorRootKnown(group.record.frames, group.startTick + born, 'blue'),
      pose: (group, tick) => actorRootPose(group.record.frames, tick),
      visible: (group, particle, tick) =>
        particle.bind === 0 || actorRootKnown(group.record.frames, tick, 'blue'),
    });
  }
}
