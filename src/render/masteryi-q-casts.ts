import { ALPHA_CAST_HISTORY_TICKS } from '../content/masteryi-q-cast-timing';
import * as THREE from 'three';
import data from '../content/masteryi-q-cast-particles.json';
import type { AlphaCastVisual } from '../simulation/masteryi-q-cast';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { masterYiTextures } from './masteryi-source-textures';
import { alphaCastParticles } from './masteryi-q-cast-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { actorRootKnown, actorRootPose } from '../simulation/actor-root-history';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined,
  ready = false;
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (address !== 0 && address !== 2)
      throw RangeError('Unsupported Alpha Strike texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Alpha Strike source texture');
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
  mesh() {
    throw Error('Alpha Strike cast contains no mesh');
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadAlphaCasts(): Promise<void> {
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
  record: AlphaCastVisual;
}
export class AlphaCasts extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, scene, ground, {
      name: 'Alpha Strike',
      attachment: 'actor-root',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.alphaCastVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.startTick,
              group: {
                key: `${unit.id}:${record.startTick}`,
                startTick: record.startTick,
                stopTick: record.startTick + ALPHA_CAST_HISTORY_TICKS,
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.startTick, 0x9e3779b9),
                record,
              },
            };
        }
      },
      particles: (group, tick) => alphaCastParticles(group.seed, (tick - group.startTick) / 60),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') &&
        actorRootKnown(group.record.frames, group.startTick + born, 'blue'),
      pose: (group, tick) => actorRootPose(group.record.frames, tick),
      visible: (group, particle, tick) =>
        particle.bind === 0 || actorRootKnown(group.record.frames, tick, 'blue'),
    });
  }
}
