import { SUMMONER_SMITE as S } from '../content/summoner-smite';
import { DEFAULT_SUMMONERS, type SummonerLoadout } from '../content/summoners';
import { TICK_RATE } from '../content/rules';
import { isLaneMinionKind, type ChampionState, type Unit } from './types';
import type { World } from './world';
import { distance } from './math';
import { ownedCompanion } from './owned-companions';
import { companionStage } from '../content/companion-policy';

/** Provisional startup: one charge, next charge one source interval after creation. */
export function equipSummoners(state: ChampionState, loadout = DEFAULT_SUMMONERS, tick = 0): void {
  if (loadout.d === loadout.f) throw new Error('Choose two different summoner spells.');
  state.summoners = { ...loadout };
  state.smite = Object.values(loadout).includes('smite')
    ? { charges: 1, rechargeTick: tick + S.rechargeSeconds * TICK_RATE }
    : null;
}
export function smiteTarget(w: World, caster: Unit, target: Unit | undefined): target is Unit {
  if (
    !target ||
    target.team === caster.team ||
    !w.alive(target) ||
    !w.visible(target, caster.team) ||
    !w.vulnerable(target)
  )
    return false;
  if (target.kind === 'monster') {
    const tags: readonly string[] = S.monsterTags[target.monster.species];
    if (
      target.monster.phase === 'returning' ||
      !tags.some((tag) => ['Monster_Large', 'Monster_Medium', 'Monster_Epic'].includes(tag))
    )
      return false;
  } else if (
    !isLaneMinionKind(target.kind) &&
    !(target.kind === 'champion' && companionStage(ownedCompanion(w, caster.id)?.fed ?? 0) > 0)
  )
    return false;
  return distance(caster, target) <= S.range + caster.radius + target.radius;
}
export function rechargeSmite(state: ChampionState, tick: number): void {
  const smite = state.smite;
  while (smite && smite.rechargeTick !== null && tick >= smite.rechargeTick) {
    smite.charges++;
    smite.rechargeTick =
      smite.charges < S.maxCharges ? smite.rechargeTick + S.rechargeSeconds * TICK_RATE : null;
  }
}
export type { SummonerLoadout };
