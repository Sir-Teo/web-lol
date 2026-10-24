import type { EclipseFrame, EclipseVisual } from '../simulation/leona-w-visuals';
import type { Team } from '../simulation/types';
import type { ImpactRig } from '../content/impact-target';
import type { EclipseRole } from './leona-eclipse-particles';

export interface EclipseDrawGroup {
  key: string;
  role: EclipseRole;
  startTick: number;
  stopTick: number;
  radius: number;
  seed: number;
  rig: ImpactRig | null;
  frames: readonly EclipseFrame[];
  /** Finite contacts/bursts require creation visibility as well as birth visibility. */
  audience: readonly Team[] | null;
  /** Caster bursts originate at the pre-movement detonation point. */
  origin: { x: number; y: number; facing: number } | null;
}

/** Dispatch stays independent of live W ownership: stopped phases and contacts
 * keep their own clocks. Source attachment/origin routing is a local policy until
 * native script dispatch is available; no source primitive is substituted here. */
export function eclipseDrawGroups(sourceId: number, r: EclipseVisual): EclipseDrawGroup[] {
  const key = `${sourceId}:${r.startTick}`,
    seed = sourceId ^ Math.imul(r.startTick, 0x9e3779b9),
    d = r.detonation;
  const groups: EclipseDrawGroup[] = [
    {
      key: key + ':initial',
      role: 'buff-initial',
      startTick: r.startTick,
      stopTick: Math.min(r.stopTick ?? Infinity, d?.tick ?? Infinity),
      radius: r.radius,
      seed,
      rig: 'leona-base',
      frames: r.frames,
      audience: null,
      origin: null,
    },
  ];
  if (!d) return groups;
  if (d.result === 'hit')
    groups.push({
      key: key + ':extended',
      role: 'buff-extended',
      startTick: d.tick,
      stopTick: r.stopTick ?? Infinity,
      radius: r.radius,
      seed: seed ^ 0x85ebca6b,
      rig: 'leona-base',
      frames: r.frames,
      audience: null,
      origin: null,
    });
  groups.push({
    key: key + ':burst',
    role: d.result === 'hit' ? 'cast-hit' : 'cast-miss',
    startTick: d.tick,
    stopTick: Infinity,
    radius: d.radius,
    seed: seed ^ 0x27d4eb2d,
    rig: null,
    frames: r.frames,
    audience: d.audience,
    origin: { ...d.point, facing: d.facing },
  });
  for (const c of d.contacts)
    groups.push({
      key: `${key}:target:${c.targetId}`,
      role: 'target',
      startTick: d.tick,
      stopTick: Infinity,
      radius: c.radius,
      seed: seed ^ Math.imul(c.targetId, 0x165667b1),
      rig: c.targetRig,
      frames: c.frames,
      audience: c.audience,
      origin: null,
    });
  return groups;
}

/** Hidden historical births never reappear when vision returns. A frozen winning
 * frame supplies only future delayed births from finite bursts; stopped buff
 * emitters cannot use terminal playback to create more continuous particles. */
export function eclipseBirthFrame(
  group: EclipseDrawGroup,
  bornTick: number,
  terminal: boolean,
  team: Team = 'blue'
): EclipseFrame | null {
  if (group.audience !== null && !group.audience.includes(team)) return null;
  const tick = group.startTick + bornTick,
    first = group.frames[0],
    last = group.frames.at(-1)!;
  let frame = group.frames[tick - first.tick];
  if (!frame && terminal && tick > last.tick && group.audience !== null) frame = last;
  return frame?.audience.includes(team) ? frame : null;
}

/** Pose clocks freeze with detached history endpoints and victory. Fractional
 * placement follows adjacent saved frames; facing takes the shortest turn. */
export function eclipsePoseAt(frames: readonly EclipseFrame[], tick: number) {
  const first = frames[0],
    last = frames.at(-1)!,
    at = Math.max(first.tick, Math.min(last.tick, tick)),
    i = Math.floor(at) - first.tick,
    before = frames[i],
    after = frames[Math.min(frames.length - 1, i + 1)],
    alpha = at - before.tick,
    facing =
      before.facing +
      Math.atan2(Math.sin(after.facing - before.facing), Math.cos(after.facing - before.facing)) *
        alpha,
    timeline = before.animationTimeline;
  return {
    x: before.x + (after.x - before.x) * alpha,
    y: before.y + (after.y - before.y) * alpha,
    facing,
    timeline,
    poseTick: timeline && timeline.tick < before.tick ? timeline.tick : at,
  };
}
