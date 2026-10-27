import { HIGHLANDER_KILL_HISTORY_TICKS } from '../content/masteryi-r-kill-timing';
import * as THREE from 'three';
import data from '../content/masteryi-r-kill-particles.json';
import type { HighlanderKillVisual } from '../simulation/masteryi-highlander-kill';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { masterYiGeometry } from './masteryi-source-geometry';
import { masterYiTextures } from './masteryi-source-textures';
import { highlanderKillParticles } from './masteryi-r-kill-particles';
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
    if (path !== data.mesh.url || !geometry) throw Error('Missing Highlander takedown mesh');
    return geometry;
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadHighlanderKills(): Promise<void> {
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
  record: HighlanderKillVisual;
}
export class HighlanderKills extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, scene, ground, {
      name: 'Highlander',
      attachment: 'actor-root',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.highlanderKillVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.castTick,
              group: {
                key: `${unit.id}:${record.castTick}:${record.extensionIndex}`,
                startTick: record.tick,
                stopTick: record.tick + HIGHLANDER_KILL_HISTORY_TICKS,
                radius: unit.radius,
                seed:
                  unit.id ^
                  Math.imul(record.tick, 0x9e3779b9) ^
                  Math.imul(record.extensionIndex, 0x85ebca6b),
                record,
              },
            };
        }
      },
      particles: (group, tick) =>
        highlanderKillParticles(group.seed, (tick - group.startTick) / 60),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') &&
        actorRootKnown(group.record.frames, group.startTick + born, 'blue'),
      pose: (group, tick) => actorRootPose(group.record.frames, tick),
      visible: (group, particle, tick) =>
        particle.bind === 0 || actorRootKnown(group.record.frames, tick, 'blue'),
    });
  }
}
