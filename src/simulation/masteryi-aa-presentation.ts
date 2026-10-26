import {
  MASTER_YI_AA_CAST_TICKS,
  MASTER_YI_AA_HIT_TICKS,
} from '../content/masteryi-aa-audio-timing';
import {
  attackSoundMaterial,
  attackSoundMaterialForRig,
  attackSoundRig,
} from '../content/attack-sound-material';
import type { ChampionState, Unit, Team, Faction } from './types';
import type { Vec2 } from './math';

type Observation = { visible(unit: Unit, team: Team): boolean };
export interface MasterYiAttackAudio {
  startTick: number;
  trailFrames: import('./actor-root-history').ActorRootRun[];
  releaseTick: number;
  endTick: number;
  kind: 'attack1' | 'crit';
  targetId: number;
  targetTeam: Faction;
  targetRig: string | null;
  origin: Vec2;
  castAudience: Team[];
  cancelTick: number | null;
  impact: {
    tick: number;
    point: Vec2;
    material: ReturnType<typeof attackSoundMaterial>;
    audience: Team[];
  } | null;
}
export function masterYiAttackExpiry(r: MasterYiAttackAudio): number {
  return Math.max(
    r.endTick,
    r.startTick + MASTER_YI_AA_CAST_TICKS,
    (r.impact?.tick ?? r.releaseTick) + MASTER_YI_AA_HIT_TICKS
  );
}
export function beginMasterYiAttack(
  state: ChampionState,
  unit: Unit,
  target: Unit,
  tick: number,
  world: Observation
): void {
  const cycle = unit.attackCycle!;
  state.masterYiAAAudio.push({
    startTick: tick,
    trailFrames: [],
    releaseTick: unit.releaseTick!,
    endTick: cycle.endTick,
    kind: cycle.critical ? 'crit' : 'attack1',
    targetId: target.id,
    targetTeam: target.team,
    targetRig: attackSoundRig(target),
    origin: { x: unit.x, y: unit.y },
    castAudience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    cancelTick: null,
    impact: null,
  });
}
function current(state: ChampionState, unit: Unit) {
  return state.masterYiAAAudio.find((r) => r.startTick === unit.attackCycle?.startTick);
}
export function contactMasterYiAttack(
  state: ChampionState,
  unit: Unit,
  target: Unit,
  tick: number,
  world: Observation
): void {
  const r = current(state, unit);
  if (!r) return;
  r.targetRig = attackSoundRig(target);
  r.impact = {
    tick,
    point: { x: target.x, y: target.y },
    material: attackSoundMaterial(target),
    audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
  };
}
export function cancelMasterYiAttack(state: ChampionState, unit: Unit, tick: number): void {
  const r = current(state, unit);
  if (r && !r.impact && r.cancelTick === null) r.cancelTick = tick;
}
export function validateMasterYiAttacks(
  state: ChampionState,
  unit: Unit,
  world: { tick: number; nextId: number; winner: unknown; units: Unit[] }
): void {
  let previous = -1;
  for (const r of state.masterYiAAAudio) {
    const target = world.units.find((t) => t.id === r.targetId);
    const pending = r.impact === null && r.cancelTick === null;
    if (
      unit.champion !== 'masteryi' ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      r.releaseTick <= r.startTick ||
      r.endTick <= r.releaseTick ||
      r.targetId === unit.id ||
      r.targetId >= world.nextId ||
      r.targetTeam === unit.team ||
      !r.castAudience.includes(unit.team as Team) ||
      world.tick >= masterYiAttackExpiry(r) ||
      (target && (target.team !== r.targetTeam || attackSoundRig(target) !== r.targetRig)) ||
      (r.kind === 'crit' && target && ['turret', 'nexus', 'inhibitor'].includes(target.kind)) ||
      (r.impact &&
        (r.cancelTick !== null ||
          r.impact.tick !== r.releaseTick ||
          r.impact.tick > world.tick ||
          r.impact.material !== attackSoundMaterialForRig(r.targetRig) ||
          !r.impact.audience.includes(unit.team as Team) ||
          (r.targetTeam !== 'neutral' && !r.impact.audience.includes(r.targetTeam)))) ||
      (r.cancelTick !== null &&
        (r.cancelTick < r.startTick ||
          r.cancelTick > r.releaseTick ||
          r.cancelTick > world.tick)) ||
      (pending &&
        (unit.deadAt !== null ||
          world.winner !== null ||
          world.tick >= r.releaseTick ||
          unit.attackCycle?.startTick !== r.startTick ||
          unit.releaseTick !== r.releaseTick ||
          unit.attackTarget !== r.targetId))
    )
      throw new Error('Saved match contains invalid Master Yi attack audio history.');
    previous = r.startTick;
  }
  const cycle = unit.attackCycle;
  if (unit.champion === 'masteryi' && cycle && world.tick < cycle.endTick) {
    const r = state.masterYiAAAudio.find((r) => r.startTick === cycle.startTick);
    if (
      !r ||
      r.endTick !== cycle.endTick ||
      (unit.releaseTick !== null && r.releaseTick !== unit.releaseTick) ||
      r.kind !== (cycle.critical ? 'crit' : 'attack1') ||
      r.cancelTick !== null
    )
      throw new Error('Saved match lacks its Master Yi attack audio history.');
  }
}
