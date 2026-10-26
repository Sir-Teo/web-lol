import * as THREE from 'three';
import data from '../content/masteryi-primary-hit-particles.json';
import { PRIMARY_HIT_HISTORY_TICKS } from '../content/masteryi-primary-hit-timing';
import type { MasterYiAttackAudio } from '../simulation/masteryi-aa-presentation';
import type { Vec2 } from '../simulation/math';
import type { ImpactRig } from '../content/impact-target';
import { masterYiTextures } from './masteryi-source-textures';
import { primaryHitParticles } from './masteryi-primary-hit-particles';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { ImpactAttachments, type AttachmentHistory } from './impact-attachments';
import { createTargetPoseSampler } from './models';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
textures.set('', white);
let pending: Promise<void> | undefined,
  ready = false;
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (address !== 0 && address !== 2) throw RangeError('Unsupported Primary hit texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Primary hit source texture');
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
    throw Error('Primary hit has no source mesh');
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadPrimaryHits(): Promise<void> {
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
  record: MasterYiAttackAudio;
  hit: NonNullable<MasterYiAttackAudio['impact']>;
}
/** Source chest declaration with independently saved poses. Procedural targets,
 * wards and structures without the bone use the shared explicit +0.9 fallback.
 * Position follows the target bone; source offsets use captured attacker facing.
 * Native inherited rotation/scale and fallback remain uncalibrated. */
export class PrimaryHits extends SourceParticleSurfaces<Group> {
  readonly attachments: Map<string, ImpactAttachments>;
  constructor(scene: THREE.Scene, ground: (point: Vec2) => number) {
    const attachments = new Map<string, ImpactAttachments>(),
      retained = new Set<string>();
    const history = (g: Group): AttachmentHistory => ({
      targetRig: g.record.targetRig,
      targetTransform: g.hit.targetTransform,
      critical: g.record.kind === 'crit',
      frames: g.hit.frames,
    });
    const frame = (g: Group, tick: number) =>
      g.hit.frames[Math.max(0, Math.min(g.hit.frames.length - 1, Math.floor(tick) - g.hit.tick))];
    const known = (g: Group, tick: number) =>
      [Math.floor(tick), Math.ceil(tick)].every((at) => frame(g, at).audience.includes('blue'));
    super(scene, scene, ground, {
      name: 'Master Yi primary hit',
      attachment: 'C_BUFFBONE_GLB_CHEST_LOC',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world) {
        retained.clear();
        for (const owner of world.units) {
          if (owner.champion !== 'masteryi') continue;
          for (const record of world.championState(owner.id)?.masterYiAAAudio ?? []) {
            const hit = record.impact;
            if (!hit || world.tick >= hit.tick + PRIMARY_HIT_HISTORY_TICKS) continue;
            const key = `${owner.id}:${record.startTick}`;
            retained.add(key);
            yield {
              sourceId: owner.id,
              castTick: record.startTick,
              group: {
                key,
                record,
                hit,
                startTick: hit.tick,
                stopTick: hit.tick + PRIMARY_HIT_HISTORY_TICKS,
                radius: hit.radius,
                seed: owner.id ^ Math.imul(record.startTick, 0x9e3779b9),
              },
            };
          }
        }
        for (const [key, path] of attachments)
          if (!retained.has(key)) {
            path.dispose();
            attachments.delete(key);
          }
      },
      particles: (g, tick) =>
        primaryHitParticles(g.seed, (tick - g.startTick) / 60, g.record.kind, g.radius),
      birthVisible: (g, born) => g.hit.audience.includes('blue') && known(g, g.startTick + born),
      visible: (g, particle, tick) =>
        g.hit.audience.includes('blue') && (particle.bind <= 0 || known(g, tick)),
      pose(g, tick) {
        const f = frame(g, tick);
        return { x: f.x, y: f.y, facing: g.hit.facing };
      },
      attachmentPoint(g, tick) {
        let path = attachments.get(g.key);
        if (!path) {
          path = new ImpactAttachments(
            g.record.targetRig
              ? createTargetPoseSampler(g.record.targetRig as ImpactRig | 'sightward-base')
              : null,
            ground,
            () => 'C_BUFFBONE_GLB_CHEST_LOC'
          );
          attachments.set(g.key, path);
        }
        return path.point(history(g), tick);
      },
    });
    this.attachments = attachments;
  }
  override dispose() {
    super.dispose();
    for (const path of this.attachments.values()) path.dispose();
    this.attachments.clear();
  }
}
