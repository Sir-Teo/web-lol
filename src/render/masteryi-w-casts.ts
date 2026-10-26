import { createLeonaEclipseSurfaceMaterial } from './leona-eclipse-surface-material';
import { MEDITATE_CAST_HISTORY_TICKS } from '../content/masteryi-w-cast-timing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/masteryi-w-cast-particles.json';
import type { MeditateCastVisual } from '../simulation/masteryi-meditate-cast';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { checkedAssetBytes, loadAuthoredMipTexture } from './authored-mip-texture';
import { meditateCastParticles } from './masteryi-w-cast-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';

const textures = new Map<string, Awaited<ReturnType<typeof loadAuthoredMipTexture>>>(),
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
    if (loaded.texture.wrapS === wrap) return loaded.texture;
    const key = `${path}:${address}`;
    let texture = samplers.get(key);
    if (!texture) {
      texture = loaded.texture.clone();
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
export function loadMeditateCasts(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      ...data.textures
        .filter((asset) => !textures.has(asset.url))
        .map(async (asset) => {
          const lookup = data.profiles.some((profile) => profile.lookup === asset.url);
          const resource = await loadAuthoredMipTexture(asset, lookup);
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
  record: MeditateCastVisual;
}
function pose(record: MeditateCastVisual, tick: number) {
  const at = (t: number) =>
    record.frames[Math.max(0, Math.min(record.frames.length - 1, t - record.startTick))];
  const a = at(Math.floor(tick)),
    b = at(Math.ceil(tick)),
    fraction = tick - Math.floor(tick),
    turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    facing: a.facing + turn * fraction,
  };
}
function known(record: MeditateCastVisual, tick: number) {
  return [Math.floor(tick), Math.ceil(tick)].every((at) =>
    record.frames[
      Math.max(0, Math.min(record.frames.length - 1, at - record.startTick))
    ].audience.includes('blue')
  );
}
export class MeditateCasts extends SourceParticleSurfaces<Group> {
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    super(scene, scene, ground, {
      name: 'Meditate',
      attachment: 'actor-root',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      material(index, resources) {
        const p = data.profiles[index];
        if (!p.multiplier) return undefined;
        return createLeonaEclipseSurfaceMaterial({
          kind: 'quad',
          texture: resources.texture(p.texture, p.uv.address),
          lookup: resources.texture(p.lookup ?? '', 2),
          multiplier: resources.texture(p.multiplier.texture, p.multiplier.uv.address),
          quadSecondaryUv: 'transformed',
          lockAlpha: p.uvMode === 2,
        });
      },
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          for (const record of world.championState(unit.id)?.meditateCastVisuals ?? [])
            yield {
              sourceId: unit.id,
              castTick: record.startTick,
              group: {
                key: `${unit.id}:${record.startTick}`,
                startTick: record.startTick,
                stopTick: record.startTick + MEDITATE_CAST_HISTORY_TICKS,
                radius: unit.radius,
                seed: unit.id ^ Math.imul(record.startTick, 0x9e3779b9),
                record,
              },
            };
        }
      },
      particles: (group, tick) => meditateCastParticles(group.seed, (tick - group.startTick) / 60),
      birthVisible: (group, born) =>
        group.record.audience.includes('blue') && known(group.record, group.startTick + born),
      pose: (group, tick) => pose(group.record, tick),
      visible: (group, particle, tick) => particle.bind === 0 || known(group.record, tick),
    });
  }
}
