import { meditateBuffExpiry } from '../simulation/masteryi-meditate-buff';
import { actorRootPose, actorRootKnown } from '../simulation/actor-root-history';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/masteryi-w-buff-particles.json';
import type { MeditateBuffVisual } from '../simulation/masteryi-meditate-buff';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { checkedAssetBytes } from './authored-mip-texture';
import { meditateTextures } from './masteryi-w-textures';
import { meditateBuffParticles } from './masteryi-w-buff-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
let geometry: THREE.BufferGeometry | undefined,
  pending: Promise<void> | undefined,
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
    if (address !== 0 && address !== 2) throw RangeError('Unsupported Meditate texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Meditate source texture');
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
    if (path !== data.mesh.url || !geometry) throw Error('Missing Meditate source mesh');
    return geometry;
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadMeditateBuffs(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      ...data.textures
        .filter((asset) => !textures.has(asset.url))
        .map(async (asset) => {
          const lookup = data.profiles.some((profile) => profile.lookup === asset.url);
          const resource = await meditateTextures.load(asset, lookup);
          textures.set(asset.url, resource);
        }),
      ...(geometry
        ? []
        : [
            (async () => {
              const raw = await checkedAssetBytes(data.mesh.url, data.mesh.bytes, data.mesh.sha256),
                gltf = await new GLTFLoader().parseAsync(raw, import.meta.env.BASE_URL),
                found: THREE.BufferGeometry[] = [];
              gltf.scene.updateMatrixWorld(true);
              let transformed = false;
              gltf.scene.traverse((node) => {
                if (!(node instanceof THREE.Mesh)) return;
                transformed ||= !node.matrixWorld.equals(new THREE.Matrix4());
                found.push(node.geometry);
                for (const material of Array.isArray(node.material)
                  ? node.material
                  : [node.material])
                  material.dispose();
              });
              if (found.length !== 1 || transformed) {
                found.forEach((item) => item.dispose());
                throw Error('Invalid Meditate mesh closure/transform');
              }
              geometry = found[0];
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
  record: MeditateBuffVisual;
}
export class MeditateBuffs extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, scene, ground, {
      name: 'Meditate Buff',
      attachment: 'actor-root',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.meditateBuffVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.startTick,
              group: {
                key: `${unit.id}:${record.startTick}`,
                startTick: record.startTick,
                stopTick: meditateBuffExpiry(record),
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.startTick, 0x9e3779b9),
                record,
              },
            };
        }
      },
      particles: (group, tick) =>
        meditateBuffParticles(
          group.seed,
          (tick - group.startTick) / 60,
          ((group.record.stopTick ?? group.record.endTick) - group.startTick) / 60
        ),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') &&
        actorRootKnown(group.record.frames, group.startTick + born, 'blue'),
      pose: (group, tick) => actorRootPose(group.record.frames, tick),
      visible: (group, particle, tick) =>
        particle.bind === 0 || actorRootKnown(group.record.frames, tick, 'blue'),
    });
  }
}
