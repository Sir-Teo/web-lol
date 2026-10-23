import { GAREN_AA_CAST_TICKS, GAREN_AA_HIT_TICKS } from '../content/garen-aa-audio-timing';
import { garenAttackAnimation } from '../content/garen-attack-animation';
import {
  attackSoundMaterial,
  attackSoundMaterialForRig,
  attackSoundRig,
} from '../content/attack-sound-material';
import type { ChampionState, Unit, Team } from './types';
type Observation = { visible(unit: Unit, team: Team): boolean };
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
  r.targetRig = attackSoundRig(target);
  r.impact = {
    tick,
    point: { x: target.x, y: target.y },
    material: attackSoundMaterial(target),
    audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
  };
}
export function cancelGarenAttack(state: ChampionState, u: Unit, tick: number) {
  const r = current(state, u);
  if (r && !r.impact && r.cancelTick === null) r.cancelTick = tick;
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
      world.tick >= garenAttackExpiry(r) ||
      (r.kind === 'crit' && target && ['turret', 'nexus', 'inhibitor'].includes(target.kind)) ||
      (target && (target.team !== r.targetTeam || attackSoundRig(target) !== r.targetRig)) ||
      (r.kind !== 'crit' && r.kind !== garenAttackAnimation(u.id, r.startTick)) ||
      (r.impact &&
        (r.cancelTick !== null ||
          r.impact.tick !== r.releaseTick ||
          r.impact.tick > world.tick ||
          r.impact.material !== attackSoundMaterialForRig(r.targetRig))) ||
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
