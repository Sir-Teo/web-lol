import type { ChampionState, LuxImpactFrame, Team, Unit } from './types';
import type { World } from './world';
import { capturePoseFrame, samePose, validPoseFrame } from './pose-history';
import { impactTargetRig, type ImpactRig } from '../content/impact-target';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';
import {
  LEONA_Q_CAST_AUDIO_TICKS,
  LEONA_Q_ATTACK_AUDIO_TICKS,
} from '../content/leona-q-audio-timing';
import {
  LEONA_Q_CAST_TAIL_TICKS,
  LEONA_Q_HIT_HISTORY_TICKS,
} from '../content/leona-q-presentation';

export type DaybreakFrame = LuxImpactFrame & { audience: Team[] };
export interface DaybreakVisual {
  startTick: number;
  rank: number;
  stopTick: number | null;
  endReason: 'consumed' | 'expired' | 'recast' | 'death' | 'match-end' | null;
  detachedTick: number | null;
  /** Actual committed starts, including attempts canceled by target loss. */
  attackStarts: number[];
  frames: DaybreakFrame[];
  impact: {
    tick: number;
    attackStartTick: number;
    targetId: number;
    targetTeam: Unit['team'];
    audience: Team[];
    targetRig: ImpactRig | null;
    targetTransform: readonly number[] | null;
    radius: number;
    detachedTick: number | null;
    frames: DaybreakFrame[];
  } | null;
}
function frame(world: World, u: Unit): DaybreakFrame {
  return {
    ...capturePoseFrame(u, world.tick),
    audience: (['blue', 'red'] as const).filter((t) => world.visible(u, t)),
  };
}
export function finishDaybreakVisual(
  state: ChampionState,
  tick: number,
  reason: NonNullable<DaybreakVisual['endReason']>
) {
  const r = state.leonaQVisuals.at(-1);
  if (r && r.stopTick === null) {
    r.stopTick = tick;
    r.endReason = reason;
    if (reason === 'death') r.detachedTick = tick;
  }
}
export function beginDaybreakVisual(world: World, u: Unit, state: ChampionState) {
  finishDaybreakVisual(state, world.tick, 'recast');
  state.leonaQVisuals.push({
    startTick: world.tick,
    rank: state.spellRanks.q,
    stopTick: null,
    endReason: null,
    detachedTick: null,
    attackStarts: [],
    frames: [frame(world, u)],
    impact: null,
  });
}
export function captureDaybreakAttack(state: ChampionState, activation: number, tick: number) {
  const r = state.leonaQVisuals.find((r) => r.startTick === activation);
  if (!r || r.stopTick !== null || (r.attackStarts.at(-1) ?? -1) >= tick)
    throw new Error('Daybreak attack lacks its active source history.');
  r.attackStarts.push(tick);
}
export function contactDaybreakVisual(world: World, u: Unit, target: Unit, state: ChampionState) {
  const r = state.leonaQVisuals.find((r) => r.startTick === u.attackCycle?.leonaQStartTick);
  if (!r) throw new Error('Committed Daybreak lacks its source presentation.');
  if (r.impact) throw new Error('Daybreak presentation already has a contact.');
  r.impact = {
    tick: world.tick,
    attackStartTick: u.attackCycle!.startTick,
    targetId: target.id,
    targetTeam: target.team,
    audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
    targetRig: impactTargetRig(target),
    targetTransform: target.structureTransform ? [...target.structureTransform] : null,
    radius: target.radius,
    detachedTick: null,
    frames: [frame(world, target)],
  };
  if (r.stopTick === null) finishDaybreakVisual(state, world.tick, 'consumed');
}
export function daybreakCasterExpiry(r: DaybreakVisual) {
  return r.stopTick === null
    ? Infinity
    : Math.max(
        r.stopTick + LEONA_Q_CAST_TAIL_TICKS,
        r.startTick + LEONA_Q_CAST_AUDIO_TICKS,
        (r.attackStarts.at(-1) ?? r.startTick) + LEONA_Q_ATTACK_AUDIO_TICKS
      );
}
export function daybreakExpiry(r: DaybreakVisual) {
  return Math.max(
    daybreakCasterExpiry(r),
    r.impact ? r.impact.tick + LEONA_Q_HIT_HISTORY_TICKS : 0
  );
}
export function advanceDaybreakVisuals(world: World) {
  const append = (frames: DaybreakFrame[], f: DaybreakFrame) => {
    if (frames.at(-1)!.tick === f.tick) frames[frames.length - 1] = f;
    else frames.push(f);
  };
  for (const u of world.units) {
    const state = world.championState(u.id);
    if (!state?.leonaQVisuals.length) continue;
    state.leonaQVisuals = state.leonaQVisuals.filter((r) => world.tick < daybreakExpiry(r));
    for (const r of state.leonaQVisuals) {
      if (world.tick < daybreakCasterExpiry(r)) {
        const old = r.frames.at(-1)!;
        const f =
          r.detachedTick === null || r.detachedTick === world.tick
            ? frame(world, u)
            : { ...structuredClone(old), tick: world.tick };
        if (r.detachedTick === null && !world.alive(u)) r.detachedTick = world.tick;
        append(r.frames, f);
      }
      const hit = r.impact;
      if (!hit || world.tick >= hit.tick + LEONA_Q_HIT_HISTORY_TICKS) continue;
      const target = world.unit(hit.targetId),
        old = hit.frames.at(-1)!;
      const f =
        (hit.detachedTick === null || hit.detachedTick === world.tick) && target
          ? frame(world, target)
          : { ...structuredClone(old), tick: world.tick };
      if (hit.detachedTick === null && (!target || !world.alive(target)))
        hit.detachedTick = world.tick;
      append(hit.frames, f);
    }
  }
}
export function validateDaybreakVisuals(
  state: ChampionState,
  u: Unit,
  world: { tick: number; nextId: number; winner: unknown; units: Unit[] }
) {
  let previous = -1;
  const history = (
    frames: DaybreakFrame[],
    start: number,
    end: number,
    rig: string | null,
    detached: number | null,
    target: Unit | undefined
  ) => {
    if (
      frames.length !== end - start + 1 ||
      frames.some(
        (f, i) =>
          f.tick !== start + i ||
          !validPoseFrame(f, rig, detached === null || f.tick < detached) ||
          (i > 0 &&
            detached !== null &&
            f.tick > detached &&
            (!samePose(f, frames[i - 1]) ||
              JSON.stringify(f.audience) !== JSON.stringify(frames[i - 1].audience)))
      )
    )
      return false;
    const last = frames.at(-1)!;
    return (
      detached !== null ||
      end < world.tick ||
      (!!target && target.hp > 0 && samePose(last, capturePoseFrame(target, end)))
    );
  };
  for (const r of state.leonaQVisuals) {
    const hit = r.impact,
      target = hit ? world.units.find((t) => t.id === hit.targetId) : undefined;
    const end = Math.min(world.tick, daybreakCasterExpiry(r) - 1);
    if (
      u.champion !== 'leona' ||
      r.rank > state.spellRanks.q ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      r.attackStarts.some(
        (t, i) =>
          t < r.startTick ||
          t > world.tick ||
          t >= r.startTick + LEONA_COMBAT_POLICY.attackWindowTicks ||
          (r.stopTick !== null && t > r.stopTick) ||
          (i > 0 && t <= r.attackStarts[i - 1])
      ) ||
      world.tick >= daybreakExpiry(r) ||
      (r.stopTick === null) !== (r.endReason === null) ||
      (r.stopTick !== null && (r.stopTick < r.startTick || r.stopTick > world.tick)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.startTick ||
          r.detachedTick > world.tick ||
          u.deadAt !== r.detachedTick)) ||
      (r.stopTick === null &&
        (!state.leonaQ ||
          state.leonaQ.startTick !== r.startTick ||
          state.leonaQ.rank !== r.rank ||
          u.hp <= 0 ||
          world.winner !== null)) ||
      (r.endReason === 'expired' &&
        r.stopTick !== r.startTick + LEONA_COMBAT_POLICY.attackWindowTicks) ||
      (r.endReason === 'consumed' && (!hit || r.stopTick !== hit.tick)) ||
      (r.endReason === 'death' &&
        (hit !== null || u.deadAt !== r.stopTick || r.detachedTick !== r.stopTick)) ||
      (r.endReason === 'match-end' &&
        (hit !== null || world.winner === null || r.stopTick !== world.tick)) ||
      (r.endReason === 'recast' &&
        (hit !== null ||
          !state.leonaQVisuals.some((next) => next !== r && next.startTick === r.stopTick))) ||
      !history(r.frames, r.startTick, end, 'leona-base', r.detachedTick, u) ||
      (hit &&
        (r.attackStarts.at(-1) !== hit.attackStartTick ||
          hit.tick !== hit.attackStartTick + LEONA_COMBAT_POLICY.daybreakWindupTicks ||
          hit.tick > world.tick ||
          hit.attackStartTick < r.startTick ||
          hit.attackStartTick >= r.startTick + LEONA_COMBAT_POLICY.attackWindowTicks ||
          hit.targetId >= world.nextId ||
          hit.targetTeam === u.team ||
          (target &&
            (target.team !== hit.targetTeam ||
              impactTargetRig(target) !== hit.targetRig ||
              target.radius !== hit.radius ||
              JSON.stringify(target.structureTransform ?? null) !==
                JSON.stringify(hit.targetTransform))) ||
          (hit.detachedTick !== null &&
            (hit.detachedTick < hit.tick ||
              hit.detachedTick > world.tick ||
              (target !== undefined && target.deadAt !== hit.detachedTick))) ||
          !history(
            hit.frames,
            hit.tick,
            Math.min(world.tick, hit.tick + LEONA_Q_HIT_HISTORY_TICKS - 1),
            hit.targetRig,
            hit.detachedTick,
            target
          )))
    )
      throw new Error('Saved match contains invalid Daybreak source presentation.');
    previous = r.startTick;
  }
  if (
    state.leonaQ &&
    !state.leonaQVisuals.some((r) => r.startTick === state.leonaQ!.startTick && r.stopTick === null)
  )
    throw new Error('Saved Daybreak lacks its source presentation.');
}
