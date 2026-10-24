import type { SolarFlareVisual } from '../simulation/leona-r-visuals';
import type { Team } from '../simulation/types';
import type { SolarRole } from './leona-solar-particles';
import { zenithBirthFrame, type ZenithDrawFrame } from './leona-zenith-history';

export interface SolarDrawGroup {
  key: string;
  role: SolarRole;
  startTick: number;
  stopTick: number;
  radius: number;
  seed: number;
  frames: readonly ZenithDrawFrame[];
  audience: readonly Team[] | null;
  origin?: { x: number; y: number; facing: number };
}

/** Local alias dispatch from saved facts, not recovered native callbacks.
 * Weapon buff runs until the accepted cast ends; cast settles at release/end.
 * One team-relative area burst starts at acceptance. Impact and per-participant
 * contact bursts start only at actual impact, including a posthumous impact. */
export function solarDrawGroups(
  sourceId: number,
  sourceTeam: Team | 'neutral',
  r: SolarFlareVisual,
  viewer: Team = 'blue'
): SolarDrawGroup[] {
  const key = `${sourceId}:${r.startTick}`,
    seed = sourceId ^ Math.imul(r.startTick, 0x9e3779b9),
    fixed = { ...r.point, facing: r.castFrame.facing },
    common = {
      startTick: r.startTick,
      radius: r.radius,
      frames: r.frames,
    },
    groups: SolarDrawGroup[] = [
      {
        ...common,
        key: key + ':buff',
        role: 'buff',
        seed,
        stopTick: r.endTick ?? Infinity,
        audience: null,
      },
      {
        ...common,
        key: key + ':cast',
        role: 'cast',
        seed: seed ^ 0x85ebca6b,
        stopTick: r.release?.tick ?? r.endTick ?? Infinity,
        audience: r.castFrame.audience,
      },
      {
        ...common,
        key: key + ':area',
        role: sourceTeam === viewer ? 'area-green' : 'area-red',
        seed: seed ^ 0x27d4eb2d,
        stopTick: Infinity,
        audience: r.areaAudience,
        origin: fixed,
        frames: r.frames.map((f) => ({ ...fixed, tick: f.tick, audience: f.areaAudience })),
      },
    ];
  if (r.impact) {
    const impact = r.impact;
    groups.push({
      ...common,
      key: key + ':impact',
      role: 'impact',
      startTick: impact.tick,
      stopTick: Infinity,
      seed: seed ^ 0xc2b2ae35,
      audience: impact.audience,
      origin: fixed,
      frames: r.frames.map((f) => ({ ...fixed, tick: f.tick, audience: f.areaAudience })),
    });
    for (const c of impact.contacts)
      groups.push({
        key: `${key}:contact:${c.targetId}`,
        role: 'contact',
        startTick: impact.tick,
        stopTick: Infinity,
        radius: c.radius,
        seed: seed ^ Math.imul(c.targetId, 0x165667b1),
        audience: c.audience,
        frames: c.frames,
      });
  }
  return groups;
}

/** Creation and per-birth vision are independent. Only finite bursts may borrow
 * the terminal frozen frame; an ended continuous buff cannot restart. */
export function solarBirthFrame(
  group: SolarDrawGroup,
  bornTick: number,
  terminal: boolean,
  team: Team = 'blue'
) {
  return zenithBirthFrame({ ...group, rig: null, role: 'contact' }, bornTick, terminal, team);
}
