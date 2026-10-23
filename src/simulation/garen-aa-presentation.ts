import { GAREN_AA_CAST_TICKS, GAREN_AA_HIT_TICKS } from '../content/garen-aa-audio-timing';
import { garenAttackAnimation } from '../content/garen-attack-animation';
import {
  GAREN_AA_SWING_ENDPOINTS,
  GAREN_AA_HIT_HISTORY_TICKS,
} from '../content/garen-aa-particle-timing';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { STRUCTURE_ANIMATION_PROFILES } from '../content/structure-animation';
import { capturePoseFrame, validPoseFrame, samePose } from './pose-history';
import {
  attackSoundMaterial,
  attackSoundMaterialForRig,
  attackSoundRig,
} from '../content/attack-sound-material';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
type Observation = { visible(unit: Unit, team: Team): boolean };
type Swing = ChampionState['garenAAVisuals'][number];
export function garenAASwingHistoryEnd(r: Swing) {
  const endpoints = GAREN_AA_SWING_ENDPOINTS.filter((e) => e.kind === r.kind);
  const duration = MOBILE_CLIP_DURATIONS['garen-base'][r.kind];
  const last = Math.max(
    r.startTick,
    ...endpoints.map(
      (e) =>
        Math.ceil(r.startTick + ((r.endTick - r.startTick) * e.seconds) / duration - 1e-5) +
        e.tailTicks
    )
  );
  return Math.min(r.poseStopTick ?? r.endTick, last);
}
export function garenAttackExpiry(r: ChampionState['garenAAVisuals'][number]) {
  return Math.max(
    r.endTick,
    r.startTick + GAREN_AA_CAST_TICKS,
    (r.impact?.tick ?? r.releaseTick) + GAREN_AA_HIT_TICKS
  );
}
export function beginGarenAttack(
  state: ChampionState,
  u: Unit,
  target: Unit,
  tick: number,
  world: Observation
) {
  const cycle = u.attackCycle!;
  state.garenAAVisuals.push({
    startTick: tick,
    releaseTick: u.releaseTick!,
    endTick: cycle.endTick,
    kind: garenAttackAnimation(u.id, tick, cycle.critical),
    targetId: target.id,
    targetTeam: target.team,
    targetRig: attackSoundRig(target),
    origin: { x: u.x, y: u.y },
    castAudience: (['blue', 'red'] as const).filter((t) => world.visible(u, t)),
    cancelTick: null,
    poseStopTick: null,
    poseStopReason: null,
    frames: [capturePoseFrame(u, tick)],
    impact: null,
  });
}
function current(state: ChampionState, u: Unit) {
  return state.garenAAVisuals.find((r) => r.startTick === u.attackCycle?.startTick);
}
export function contactGarenAttack(
  state: ChampionState,
  u: Unit,
  target: Unit,
  tick: number,
  world: Observation
) {
  const r = current(state, u);
  if (!r) return;
  const audience = (['blue', 'red'] as const).filter((t) => world.visible(target, t));
  r.targetRig = attackSoundRig(target);
  r.impact = {
    tick,
    point: { x: target.x, y: target.y },
    material: attackSoundMaterial(target),
    audience,
    facing: u.facing,
    radius: target.radius,
    targetTransform: target.structureTransform ? [...target.structureTransform] : null,
    detachedTick: null,
    frames: [{ ...capturePoseFrame(target, tick), audience: [...audience] }],
  };
}
export function cancelGarenAttack(
  state: ChampionState,
  u: Unit,
  tick: number,
  reason: NonNullable<Swing['poseStopReason']> = 'action'
) {
  const r = current(state, u);
  if (!r) return;
  if (!r.impact && r.cancelTick === null) r.cancelTick = tick;
  if (r.poseStopTick === null) {
    r.poseStopTick = Math.min(tick, r.endTick);
    r.poseStopReason = tick >= r.endTick ? 'complete' : reason;
  }
}
export function advanceGarenAttackPoses(world: World) {
  const append = <T extends Swing['frames'][number]>(frames: T[], frame: T) => {
    if (frames.at(-1)!.tick === frame.tick) frames[frames.length - 1] = frame;
    else frames.push(frame);
  };
  for (const u of world.units) {
    if (u.champion !== 'garen') continue;
    const records = world.championState(u.id)?.garenAAVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (r.poseStopTick === null && world.tick >= r.endTick) {
        r.poseStopTick = r.endTick;
        r.poseStopReason = 'complete';
      }
      if (world.tick <= garenAASwingHistoryEnd(r))
        append(r.frames, capturePoseFrame(u, world.tick));
      const hit = r.impact;
      if (!hit || world.tick >= hit.tick + GAREN_AA_HIT_HISTORY_TICKS) continue;
      const target = world.unit(r.targetId),
        previous = hit.frames.at(-1)!;
      const attached = hit.detachedTick === null && target;
      const frame = attached
        ? {
            ...capturePoseFrame(target, world.tick),
            audience: (['blue', 'red'] as const).filter((team) => world.visible(target, team)),
          }
        : { ...structuredClone(previous), tick: world.tick };
      // Lethal cleanup may remove the last vision source after the accepted
      // contact. Preserve its already-known endpoint, never a later hidden move.
      if (
        target &&
        !world.alive(target) &&
        world.tick === hit.tick &&
        frame.x === hit.point.x &&
        frame.y === hit.point.y
      )
        frame.audience = [...hit.audience];
      if (hit.detachedTick === null && (!target || !world.alive(target)))
        hit.detachedTick = world.tick;
      append(hit.frames, frame);
    }
  }
}
export function validateGarenAttacks(
  state: ChampionState,
  u: Unit,
  world: { tick: number; nextId: number; winner: unknown; units: Unit[] }
) {
  let previous = -1;
  for (const r of state.garenAAVisuals) {
    const target = world.units.find((t) => t.id === r.targetId),
      pending = !r.impact && r.cancelTick === null;
    const lastPoseTick = Math.min(world.tick, garenAASwingHistoryEnd(r));
    const hit = r.impact;
    const hitEnd = hit ? Math.min(world.tick, hit.tick + GAREN_AA_HIT_HISTORY_TICKS - 1) : 0;
    if (
      u.champion !== 'garen' ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      r.targetId >= world.nextId ||
      r.targetTeam === u.team ||
      r.targetId === u.id ||
      !r.castAudience.includes(u.team as Team) ||
      (r.impact &&
        (!r.impact.audience.includes(u.team as Team) ||
          (r.targetTeam !== 'neutral' && !r.impact.audience.includes(r.targetTeam)))) ||
      r.releaseTick <= r.startTick ||
      r.releaseTick >= r.endTick ||
      (r.poseStopTick === null) !== (r.poseStopReason === null) ||
      (r.poseStopTick === null && world.tick >= r.endTick) ||
      (r.poseStopTick !== null &&
        (r.poseStopTick < r.startTick ||
          r.poseStopTick > Math.min(world.tick, r.endTick) ||
          (r.poseStopReason === 'complete') !== (r.poseStopTick === r.endTick))) ||
      (r.cancelTick !== null && r.poseStopTick !== r.cancelTick) ||
      r.frames.length !== lastPoseTick - r.startTick + 1 ||
      r.frames.some(
        (f, i) =>
          f.tick !== r.startTick + i ||
          !validPoseFrame(f, 'garen-base', r.poseStopTick === null || f.tick < r.poseStopTick)
      ) ||
      (lastPoseTick === world.tick &&
        !samePose(r.frames.at(-1)!, capturePoseFrame(u, world.tick))) ||
      world.tick >= garenAttackExpiry(r) ||
      (r.kind === 'crit' && target && ['turret', 'nexus', 'inhibitor'].includes(target.kind)) ||
      (target && (target.team !== r.targetTeam || attackSoundRig(target) !== r.targetRig)) ||
      (r.kind !== 'crit' && r.kind !== garenAttackAnimation(u.id, r.startTick)) ||
      (r.impact &&
        (r.cancelTick !== null ||
          r.impact.tick !== r.releaseTick ||
          r.impact.tick > world.tick ||
          r.impact.material !== attackSoundMaterialForRig(r.targetRig))) ||
      (hit &&
        ((!Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, r.targetRig ?? '') &&
          hit.targetTransform !== null) ||
          (target &&
            (hit.radius !== target.radius ||
              JSON.stringify(hit.targetTransform) !==
                JSON.stringify(target.structureTransform ?? null))) ||
          hit.frames.length !== hitEnd - hit.tick + 1 ||
          (hit.detachedTick !== null &&
            (hit.detachedTick < hit.tick || hit.detachedTick > hitEnd)) ||
          (hit.detachedTick === null &&
            hitEnd === world.tick &&
            (!target ||
              target.hp <= 0 ||
              !samePose(hit.frames.at(-1)!, capturePoseFrame(target, world.tick)))) ||
          hit.frames.some(
            (f, i) =>
              f.tick !== hit.tick + i ||
              (r.targetTeam !== 'neutral' && !f.audience.includes(r.targetTeam)) ||
              !validPoseFrame(
                f,
                r.targetRig,
                hit.detachedTick === null || f.tick < hit.detachedTick
              ) ||
              (i > 0 &&
                hit.detachedTick !== null &&
                f.tick > hit.detachedTick &&
                (!samePose(f, hit.frames[i - 1]) ||
                  JSON.stringify(f.audience) !== JSON.stringify(hit.frames[i - 1].audience)))
          ))) ||
      (r.cancelTick !== null &&
        (r.cancelTick < r.startTick ||
          r.cancelTick > r.releaseTick ||
          r.cancelTick > world.tick)) ||
      (pending &&
        (u.deadAt !== null ||
          world.winner !== null ||
          world.tick >= r.releaseTick ||
          u.attackCycle?.startTick !== r.startTick ||
          u.releaseTick !== r.releaseTick ||
          u.attackTarget !== r.targetId))
    )
      throw Error('Saved match contains invalid Garen basic attack presentation.');
    previous = r.startTick;
  }
  const cycle = u.attackCycle;
  if (
    u.champion === 'garen' &&
    cycle &&
    cycle.garenQRank === undefined &&
    world.tick < cycle.endTick
  ) {
    const r = state.garenAAVisuals.find((r) => r.startTick === cycle.startTick);
    if (
      !r ||
      r.endTick !== cycle.endTick ||
      r.kind !== garenAttackAnimation(u.id, cycle.startTick, cycle.critical) ||
      r.cancelTick !== null
    )
      throw Error('Saved match lacks its Garen basic attack presentation.');
  }
}
