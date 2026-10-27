import { MEDITATE_DAMAGE_HISTORY_TICKS } from '../content/masteryi-w-damage-timing';
import * as THREE from 'three';
import data from '../content/masteryi-w-damage-particles.json';
import type { MeditateDamageVisual } from '../simulation/masteryi-meditate-damage';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { masterYiTextures } from './masteryi-source-textures';
import { meditateDamageParticles } from './masteryi-w-damage-particles';
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
      throw RangeError('Unsupported Meditate damage texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Meditate damage source texture');
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
    throw Error('Meditate damage has no source mesh');
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadMeditateDamage(): Promise<void> {
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
  record: MeditateDamageVisual;
}
export class MeditateDamage extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, scene, ground, {
      name: 'Meditate damage',
      attachment: 'actor-root',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.meditateDamageVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.castTick,
              group: {
                key: `${unit.id}:${record.tick}`,
                startTick: record.tick,
                stopTick: record.tick + MEDITATE_DAMAGE_HISTORY_TICKS,
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.tick, 0x9e3779b9),
                record,
              },
            };
        }
      },
      particles: (group, tick) =>
        meditateDamageParticles(group.seed, (tick - group.startTick) / 60),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') &&
        actorRootKnown(group.record.frames, group.startTick + born, 'blue'),
      pose: (group, tick) => actorRootPose(group.record.frames, tick),
      visible: (group, particle, tick) =>
        particle.bind === 0 || actorRootKnown(group.record.frames, tick, 'blue'),
    });
  }
}
