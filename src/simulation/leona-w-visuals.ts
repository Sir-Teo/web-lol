import type { ChampionState, LuxImpactFrame, Team, Unit } from './types';
import type { World } from './world';
import { capturePoseFrame, samePose, validPoseFrame } from './pose-history';
import { impactTargetRig, type ImpactRig } from '../content/impact-target';
import timing from '../content/leona-w-presentation.json';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';

export type EclipseFrame = LuxImpactFrame & { audience: Team[] };
export interface EclipseVisual {
  startTick: number;
  rank: number;
  radius: number;
  stopTick: number | null;
  endReason: 'miss' | 'expired' | 'recast' | 'death' | 'match-end' | null;
  detachedTick: number | null;
  frames: EclipseFrame[];
  detonation: {
    tick: number;
    result: 'hit' | 'miss';
    point: { x: number; y: number };
    facing: number;
    radius: number;
    audience: Team[];
    contacts: {
      targetId: number;
      targetKind: Unit['kind'];
      targetTeam: Unit['team'];
      targetRig: ImpactRig | null;
      radius: number;
      audience: Team[];
      detachedTick: number | null;
      frames: EclipseFrame[];
    }[];
  } | null;
}
function frame(world: World, unit: Unit): EclipseFrame {
  return {
    ...capturePoseFrame(unit, world.tick),
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
  };
}
export function finishEclipseVisual(
  state: ChampionState,
  tick: number,
  reason: NonNullable<EclipseVisual['endReason']>
) {
  const r = state.leonaWVisuals.at(-1);
  if (r && r.stopTick === null) {
    r.stopTick = tick;
    r.endReason = reason;
    if (reason === 'death') r.detachedTick = tick;
  }
}
export function beginEclipseVisual(world: World, unit: Unit, state: ChampionState) {
  finishEclipseVisual(state, world.tick, 'recast');
  state.leonaWVisuals.push({
    startTick: world.tick,
    rank: state.spellRanks.w,
    radius: unit.radius,
    stopTick: null,
    endReason: null,
    detachedTick: null,
    frames: [frame(world, unit)],
    detonation: null,
  });
}
export function captureEclipseDetonation(
  world: World,
  source: Unit,
  state: ChampionState,
  targets: readonly Unit[]
) {
  const r = state.leonaWVisuals.at(-1);
  if (!r || r.stopTick !== null || r.startTick !== state.leonaW?.startTick || r.detonation)
    throw Error('Eclipse detonation lacks its source presentation');
  r.detonation = {
    tick: world.tick,
    result: targets.length ? 'hit' : 'miss',
    point: { x: source.x, y: source.y },
    facing: source.facing,
    radius: source.radius,
    audience: (['blue', 'red'] as const).filter((t) => world.visible(source, t)),
    contacts: targets.map((target) => ({
      targetId: target.id,
      targetKind: target.kind,
      targetTeam: target.team,
      targetRig: impactTargetRig(target),
      radius: target.radius,
      audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
      detachedTick: null,
      frames: [frame(world, target)],
    })),
  };
  if (!targets.length) finishEclipseVisual(state, world.tick, 'miss');
}
export function eclipseVisualExpiry(r: EclipseVisual) {
  if (r.stopTick === null) return Infinity;
  return Math.max(
    r.stopTick + Math.max(timing.initialTailTicks, timing.extendedTailTicks),
    r.detonation
      ? r.detonation.tick +
          Math.max(timing.hitHistoryTicks, timing.missHistoryTicks, timing.targetHistoryTicks)
      : 0
  );
}
export function advanceEclipseVisuals(world: World) {
  const append = (frames: EclipseFrame[], f: EclipseFrame) => {
    if (frames.at(-1)!.tick === f.tick) frames[frames.length - 1] = f;
    else frames.push(f);
  };
  for (const source of world.units) {
    const state = world.championState(source.id);
    if (!state?.leonaWVisuals.length) continue;
    state.leonaWVisuals = state.leonaWVisuals.filter((r) => world.tick < eclipseVisualExpiry(r));
    for (const r of state.leonaWVisuals) {
      const last = r.frames.at(-1)!;
      const f =
        r.detachedTick === null || r.detachedTick === world.tick
          ? frame(world, source)
          : { ...structuredClone(last), tick: world.tick };
      if (r.detachedTick === null && !world.alive(source)) r.detachedTick = world.tick;
      append(r.frames, f);
      if (!r.detonation || world.tick >= r.detonation.tick + timing.targetHistoryTicks) continue;
      for (const c of r.detonation.contacts) {
        const target = world.unit(c.targetId),
          old = c.frames.at(-1)!;
        const f =
          (c.detachedTick === null || c.detachedTick === world.tick) && target
            ? frame(world, target)
            : { ...structuredClone(old), tick: world.tick };
        if (c.detachedTick === null && (!target || !world.alive(target)))
          c.detachedTick = world.tick;
        append(c.frames, f);
      }
    }
  }
}
export function validateEclipseVisuals(
  state: ChampionState,
  source: Unit,
  world: { tick: number; nextId: number; winner: unknown; units: Unit[] }
) {
  const fail = () => {
    throw Error('Saved match contains invalid Eclipse source presentation.');
  };
  const history = (
    frames: EclipseFrame[],
    start: number,
    end: number,
    rig: string | null,
    detached: number | null,
    target: Unit | undefined
  ) => {
    if (frames.length !== end - start + 1) return false;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.tick !== start + i || !validPoseFrame(f, rig, detached === null || f.tick < detached))
        return false;
      if (
        i > 0 &&
        detached !== null &&
        f.tick > detached &&
        (!samePose(f, frames[i - 1]) ||
          JSON.stringify(f.audience) !== JSON.stringify(frames[i - 1].audience))
      )
        return false;
    }
    return (
      detached !== null ||
      end < world.tick ||
      (!!target && target.hp > 0 && samePose(frames.at(-1)!, capturePoseFrame(target, end)))
    );
  };
  let previous = -1;
  for (const r of state.leonaWVisuals) {
    const d = r.detonation;
    if (
      source.champion !== 'leona' ||
      r.rank > state.spellRanks.w ||
      r.radius !== source.radius ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      world.tick >= eclipseVisualExpiry(r) ||
      (r.stopTick === null) !== (r.endReason === null) ||
      (r.stopTick !== null && (r.stopTick < r.startTick || r.stopTick > world.tick)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.startTick ||
          r.detachedTick > world.tick ||
          source.deadAt !== r.detachedTick)) ||
      (r.stopTick === null &&
        (!state.leonaW ||
          state.leonaW.startTick !== r.startTick ||
          state.leonaW.rank !== r.rank ||
          state.leonaW.detonated !== (d?.result === 'hit') ||
          source.hp <= 0 ||
          world.winner !== null)) ||
      (r.endReason === 'miss' && (!d || d.result !== 'miss' || r.stopTick !== d.tick)) ||
      (r.endReason === 'expired' &&
        (!d ||
          d.result !== 'hit' ||
          r.stopTick !== r.startTick + 2 * LEONA_COMBAT_POLICY.eclipseDurationTicks)) ||
      (r.endReason === 'death' &&
        (source.deadAt !== r.stopTick || r.detachedTick !== r.stopTick)) ||
      (r.endReason === 'match-end' && (world.winner === null || r.stopTick !== world.tick)) ||
      (r.endReason === 'recast' &&
        !state.leonaWVisuals.some((n) => n !== r && n.startTick === r.stopTick)) ||
      !history(r.frames, r.startTick, world.tick, 'leona-base', r.detachedTick, source)
    )
      fail();
    if (d) {
      if (
        d.tick !== r.startTick + LEONA_COMBAT_POLICY.eclipseDurationTicks ||
        d.tick > world.tick ||
        (r.stopTick !== null && r.stopTick < d.tick) ||
        d.radius !== source.radius ||
        (d.result === 'hit') !== d.contacts.length > 0
      )
        fail();
      if (d.result === 'miss' && (r.endReason !== 'miss' || r.stopTick !== d.tick)) fail();
      const ids = new Set<number>();
      for (const c of d.contacts) {
        const target = world.units.find((t) => t.id === c.targetId);
        if (
          c.targetId >= world.nextId ||
          ids.has(c.targetId) ||
          c.targetTeam === source.team ||
          ['turret', 'inhibitor', 'nexus', 'ward'].includes(c.targetKind) ||
          (target &&
            (target.kind !== c.targetKind ||
              target.team !== c.targetTeam ||
              target.radius !== c.radius ||
              impactTargetRig(target) !== c.targetRig)) ||
          (c.detachedTick !== null &&
            (c.detachedTick < d.tick ||
              c.detachedTick > world.tick ||
              (target !== undefined && target.deadAt !== c.detachedTick))) ||
          !history(
            c.frames,
            d.tick,
            Math.min(world.tick, d.tick + timing.targetHistoryTicks - 1),
            c.targetRig,
            c.detachedTick,
            target
          )
        )
          fail();
        ids.add(c.targetId);
      }
    } else {
      const release = r.startTick + LEONA_COMBAT_POLICY.eclipseDurationTicks;
      if (r.stopTick === null ? world.tick >= release : r.stopTick > release) fail();
    }
    previous = r.startTick;
  }
  if (
    state.leonaW &&
    !state.leonaWVisuals.some((r) => r.startTick === state.leonaW!.startTick && r.stopTick === null)
  )
    fail();
}
