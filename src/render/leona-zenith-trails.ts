import { sourceTrailRibbon, type SourceRibbonVertex } from './source-trail-ribbon';
import { Euler, Quaternion, Vector3 } from 'three';
import type { Team } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import { zenithParticles, ZENITH_PROFILES } from './leona-zenith-particles';
import {
  zenithBirthFrame,
  zenithPathDistance,
  zenithPoseAt,
  type ZenithDrawGroup,
} from './leona-zenith-history';

export interface ZenithTrailPoint {
  profileIndex: number;
  ordinal: number;
  bornTick: number;
  position: [number, number, number];
  halfWidth: number;
  wakeU: number;
  uvOffset: number[];
  uvScale: number[];
  side: [number, number, number];
  lookup: [number, number];
  erosion: number;
  color: number[];
  visible: boolean;
}
/** Source-centimetre trail points, newest first. WAKE uses the complete retained
 * emitter path at birth, not a remeasured shrinking ribbon. Hidden points remain
 * separators; dropping them here would join across unseen trajectory. */
export function zenithTrailPoints(
  group: ZenithDrawGroup,
  tick: number,
  terminal = false,
  team: Team = 'blue',
  ground: (point: Vec2) => number = () => 0
): ZenithTrailPoint[] {
  if (group.role !== 'weapon') return [];
  return zenithParticles(
    group.role,
    group.seed,
    (tick - group.startTick) / 60,
    (group.stopTick - group.startTick) / 60,
    group.radius
  )
    .filter((p) => ZENITH_PROFILES[p.profileIndex].kind === 'trail')
    .map((p) => {
      const profile = ZENITH_PROFILES[p.profileIndex],
        bornTick = group.startTick + p.bornTick,
        birth = zenithPoseAt(group.frames, bornTick)!,
        now = zenithPoseAt(group.frames, tick)!,
        bind = Math.max(0, Math.min(1, p.bind)),
        origin = { x: birth.x + (now.x - birth.x) * bind, y: birth.y + (now.y - birth.y) * bind },
        facing = profile.local ? (bind === 1 ? now.facing : birth.facing) : 0,
        x = -p.offset[0],
        z = p.offset[2],
        c = Math.cos(facing),
        s = Math.sin(facing),
        localSide = new Vector3(1, 0, 0).applyQuaternion(
          new Quaternion().setFromEuler(
            new Euler(
              ...(p.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
              'YXZ'
            )
          )
        );
      return {
        profileIndex: p.profileIndex,
        ordinal: p.ordinal,
        bornTick,
        position: [
          origin.x + x * c + z * s,
          ground(origin) + p.offset[1],
          origin.y - x * s + z * c,
        ] as [number, number, number],
        halfWidth: p.size[0],
        side: [
          -localSide.x * c + localSide.z * s,
          localSide.y,
          localSide.x * s + localSide.z * c,
        ] as [number, number, number],
        uvScale: p.uv.scale,
        lookup: p.lookup,
        erosion: p.erosion,
        wakeU: zenithPathDistance(group, bornTick) / p.tiling![0],
        uvOffset: p.uv.offset,
        color: p.color,
        visible: !!zenithBirthFrame(group, p.bornTick, terminal, team),
      };
    })
    .sort((a, b) => a.profileIndex - b.profileIndex || b.ordinal - a.ordinal);
}

/** Source-backed shared extrusion; attachment and birth visibility stay above. */
export const zenithTrailRibbon = sourceTrailRibbon<ZenithTrailPoint>;
export type ZenithRibbonVertex = SourceRibbonVertex;
