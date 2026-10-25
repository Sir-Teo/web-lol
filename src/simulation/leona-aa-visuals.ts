import type { ChampionState, Faction, LuxImpactFrame, Team, Unit } from './types';
import type { World } from './world';
import { leonaAttackAnimation } from '../content/leona-presentation';
import { LEONA_AA_CAST_TICKS, LEONA_AA_HIT_TICKS } from '../content/leona-aa-audio-timing';
import {
  attackSoundMaterial,
  attackSoundMaterialForRig,
  attackSoundRig,
  type AttackSoundMaterial,
} from '../content/attack-sound-material';
import { capturePoseFrame, samePose, validPoseFrame } from './pose-history';
import { STRUCTURE_ANIMATION_PROFILES } from '../content/structure-animation';
export type LeonaAttackKind = ReturnType<typeof leonaAttackAnimation>;
export type LeonaAttackEnd =
  'complete' | 'order' | 'target-lost' | 'action' | 'recast' | 'death' | 'match-end';
export interface LeonaAttackVisual {
  startTick: number;
  releaseTick: number;
  endTick: number;
  kind: LeonaAttackKind;
  critical: boolean;
  eclipse: boolean;
  targetId: number;
  targetTeam: Faction;
  targetRig: string | null;
  castAudience: Team[];
  cancelTick: number | null;
  stopTick: number | null;
  endReason: LeonaAttackEnd | null;
  detachedTick: number | null;
  frames: LuxImpactFrame[];
  impact: {
    tick: number;
    point: { x: number; y: number };
    material: AttackSoundMaterial;
    audience: Team[];
    facing: number;
    radius: number;
    targetTransform: readonly number[] | null;
    detachedTick: number | null;
    frames: (LuxImpactFrame & { audience: Team[] })[];
  } | null;
}
const audience = (world: World, u: Unit) =>
  (['blue', 'red'] as const).filter((team) => world.visible(u, team));
export function leonaAttackExpiry(r: LeonaAttackVisual) {
  return Math.max(
    r.endTick,
    r.startTick + LEONA_AA_CAST_TICKS,
    r.impact ? r.impact.tick + LEONA_AA_HIT_TICKS : 0
  );
}
export function beginLeonaAttack(world: World, u: Unit, state: ChampionState, target: Unit) {
  const c = u.attackCycle!;
  if (c.leonaQRank !== undefined) throw Error('Daybreak cannot begin an ordinary attack history.');
  state.leonaAAVisuals.push({
    startTick: c.startTick,
    releaseTick: u.releaseTick!,
    endTick: c.endTick,
    kind: leonaAttackAnimation(u.id, c.startTick, c.critical, c.leonaEclipse),
    critical: c.critical === true,
    eclipse: c.leonaEclipse === true,
    targetId: target.id,
    targetTeam: target.team,
    targetRig: attackSoundRig(target),
    castAudience: audience(world, u),
    cancelTick: null,
    stopTick: null,
    endReason: null,
    detachedTick: null,
    frames: [capturePoseFrame(u, world.tick)],
    impact: null,
  });
}
function current(state: ChampionState, u: Unit) {
  return state.leonaAAVisuals.find((r) => r.startTick === u.attackCycle?.startTick);
}
export function finishLeonaAttack(
  state: ChampionState,
  u: Unit,
  tick: number,
  reason: LeonaAttackEnd
) {
  const r = current(state, u);
  if (!r) return;
  if (!r.impact && r.cancelTick === null) r.cancelTick = tick;
  if (r.stopTick === null) {
    r.stopTick = Math.min(tick, r.endTick);
    r.endReason = tick >= r.endTick ? 'complete' : reason;
  }
}
export function contactLeonaAttack(world: World, u: Unit, state: ChampionState, target: Unit) {
  const r = current(state, u);
  if (!r || r.impact || r.cancelTick !== null)
    throw Error('Leona contact lacks its committed ordinary attack history.');
  r.targetRig = attackSoundRig(target);
  const seen = audience(world, target);
  r.impact = {
    tick: world.tick,
    point: { x: target.x, y: target.y },
    material: attackSoundMaterial(target),
    audience: seen,
    facing: u.facing,
    radius: target.radius,
    targetTransform: target.structureTransform ? [...target.structureTransform] : null,
    detachedTick: null,
    frames: [{ ...capturePoseFrame(target, world.tick), audience: [...seen] }],
  };
}
export function advanceLeonaAttacks(world: World) {
  const append = <T extends LuxImpactFrame>(frames: T[], f: T) => {
    if (frames.at(-1)!.tick === f.tick) frames[frames.length - 1] = f;
    else frames.push(f);
  };
  for (const u of world.units) {
    if (u.champion !== 'leona') continue;
    const state = world.championState(u.id)!;
    state.leonaAAVisuals = state.leonaAAVisuals.filter((r) => world.tick < leonaAttackExpiry(r));
    for (const r of state.leonaAAVisuals) {
      if (r.stopTick === null && world.tick >= r.endTick) {
        r.stopTick = r.endTick;
        r.endReason = 'complete';
      }
      if (world.tick < r.startTick + LEONA_AA_CAST_TICKS) {
        const f =
          r.detachedTick === null
            ? capturePoseFrame(u, world.tick)
            : { ...structuredClone(r.frames.at(-1)!), tick: world.tick };
        if (r.detachedTick === null && !world.alive(u)) r.detachedTick = world.tick;
        append(r.frames, f);
      }
      const hit = r.impact;
      if (!hit || world.tick >= hit.tick + LEONA_AA_HIT_TICKS) continue;
      const target = world.unit(r.targetId),
        old = hit.frames.at(-1)!;
      const f =
        hit.detachedTick === null && target
          ? { ...capturePoseFrame(target, world.tick), audience: audience(world, target) }
          : { ...structuredClone(old), tick: world.tick };
      if (
        target &&
        !world.alive(target) &&
        world.tick === hit.tick &&
        f.x === hit.point.x &&
        f.y === hit.point.y
      )
        f.audience = [...hit.audience];
      if (hit.detachedTick === null && (!target || !world.alive(target)))
        hit.detachedTick = world.tick;
      append(hit.frames, f);
    }
  }
}
export function validateLeonaAttacks(
  state: ChampionState,
  u: Unit,
  world: { tick: number; nextId: number; winner: unknown; units: Unit[] }
) {
  let previous = -1;
  const history = (
    frames: LuxImpactFrame[],
    start: number,
    end: number,
    rig: string | null,
    detached: number | null,
    target: Unit | undefined
  ) =>
    frames.length === end - start + 1 &&
    !frames.some(
      (f, i) =>
        f.tick !== start + i ||
        !validPoseFrame(f, rig, detached === null || f.tick < detached) ||
        (i > 0 && detached !== null && f.tick > detached && !samePose(f, frames[i - 1]))
    ) &&
    (detached !== null ||
      end < world.tick ||
      (!!target && target.hp > 0 && samePose(frames.at(-1)!, capturePoseFrame(target, end))));
  for (const r of state.leonaAAVisuals) {
    const target = world.units.find((t) => t.id === r.targetId),
      hit = r.impact,
      pending = hit === null && r.cancelTick === null;
    const end = Math.min(world.tick, r.startTick + LEONA_AA_CAST_TICKS - 1);
    if (
      u.champion !== 'leona' ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      world.tick >= leonaAttackExpiry(r) ||
      r.releaseTick <= r.startTick ||
      r.releaseTick >= r.endTick ||
      (r.critical && r.eclipse) ||
      (r.eclipse && !state.spellRanks.w) ||
      r.kind !== leonaAttackAnimation(u.id, r.startTick, r.critical, r.eclipse) ||
      (r.critical && Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, r.targetRig ?? '')) ||
      r.targetId === u.id ||
      r.targetId >= world.nextId ||
      r.targetTeam === u.team ||
      !r.castAudience.includes(u.team as Team) ||
      (target && (target.team !== r.targetTeam || attackSoundRig(target) !== r.targetRig)) ||
      (r.stopTick === null) !== (r.endReason === null) ||
      (r.stopTick !== null && hit === null && r.cancelTick === null) ||
      (hit !== null && r.stopTick !== null && r.stopTick < hit.tick) ||
      (r.stopTick === null && world.tick >= r.endTick) ||
      (r.stopTick !== null &&
        (r.stopTick < r.startTick ||
          r.stopTick > Math.min(world.tick, r.endTick) ||
          (r.endReason === 'complete') !== (r.stopTick === r.endTick))) ||
      (r.cancelTick !== null &&
        (hit !== null ||
          r.cancelTick < r.startTick ||
          r.cancelTick > Math.min(world.tick, r.releaseTick) ||
          r.stopTick !== r.cancelTick)) ||
      (r.endReason === 'death' && u.deadAt !== r.stopTick) ||
      (r.endReason === 'match-end' && (world.winner === null || r.stopTick !== world.tick)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.startTick || r.detachedTick > end || u.deadAt !== r.detachedTick)) ||
      !history(r.frames, r.startTick, end, 'leona-base', r.detachedTick, u) ||
      (pending &&
        (u.deadAt !== null ||
          world.winner !== null ||
          world.tick >= r.releaseTick ||
          u.attackCycle?.startTick !== r.startTick ||
          u.releaseTick !== r.releaseTick ||
          u.attackTarget !== r.targetId)) ||
      (hit &&
        (hit.tick !== r.releaseTick ||
          hit.tick > world.tick ||
          hit.material !== attackSoundMaterialForRig(r.targetRig) ||
          (!Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, r.targetRig ?? '') &&
            hit.targetTransform !== null) ||
          !hit.audience.includes(u.team as Team) ||
          (r.targetTeam !== 'neutral' && !hit.audience.includes(r.targetTeam)) ||
          (target &&
            (target.radius !== hit.radius ||
              JSON.stringify(target.structureTransform ?? null) !==
                JSON.stringify(hit.targetTransform))) ||
          hit.frames[0].x !== hit.point.x ||
          hit.frames[0].y !== hit.point.y ||
          (hit.detachedTick !== null &&
            (hit.detachedTick < hit.tick ||
              hit.detachedTick > world.tick ||
              (target !== undefined && target.deadAt !== hit.detachedTick))) ||
          !history(
            hit.frames,
            hit.tick,
            Math.min(world.tick, hit.tick + LEONA_AA_HIT_TICKS - 1),
            r.targetRig,
            hit.detachedTick,
            target
          ) ||
          hit.frames.some(
            (f, i) =>
              (r.targetTeam !== 'neutral' && !f.audience.includes(r.targetTeam)) ||
              (i > 0 &&
                hit.detachedTick !== null &&
                f.tick > hit.detachedTick &&
                JSON.stringify(f.audience) !== JSON.stringify(hit.frames[i - 1].audience))
          )))
    )
      throw Error('Saved match contains invalid Leona ordinary attack history.');
    previous = r.startTick;
  }
  const c = u.attackCycle;
  if (u.champion === 'leona' && c && c.leonaQRank === undefined && world.tick < c.endTick) {
    const r = state.leonaAAVisuals.find((r) => r.startTick === c.startTick);
    if (
      !r ||
      r.endTick !== c.endTick ||
      r.critical !== (c.critical === true) ||
      r.eclipse !== (c.leonaEclipse === true) ||
      r.cancelTick !== null
    )
      throw Error('Saved Leona attack lacks its source history.');
  }
}
