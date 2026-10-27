import { ABILITIES } from '../content/rules';
import type { Ability, Unit } from '../simulation/types';
import { GAREN_R } from '../content/garen-r';
import { GAREN_E_RECAST_TICKS } from '../simulation/garen-e';
import { distance } from '../simulation/math';
import type { World } from '../simulation/world';
import { isSummonerSlot } from '../content/summoners';
import { smiteTarget } from '../simulation/smite';
import { alphaTarget } from '../simulation/masteryi-alpha-strike';
import { MASTER_YI_Q } from '../content/masteryi-q';

/** Input policy follows the current caster, including Lux's point-free E recast. */
export function instantSpell(world: World, ability: Ability): boolean {
  if (isSummonerSlot(ability)) return world.summonerSpell(ability) === 'heal';
  if (world.hero.champion === 'garen') return ability === 'q' || ability === 'w' || ability === 'e';
  if (world.hero.champion === 'ahri') return ability === 'w';
  if (world.hero.champion === 'masteryi') return ability !== 'q';
  if (world.hero.champion === 'leona') return ability === 'q' || ability === 'w';
  if (world.hero.champion !== 'lux') return ability === 'q';
  return (
    ability === 'e' &&
    (world.player.pendingCast?.ability === 'e' ||
      world.singularities.some(
        (zone) => zone.sourceId === world.hero.id && zone.detonatedTick === null
      ))
  );
}

export function minimapSpell(world: World, ability: Ability): boolean {
  // Lux's local aimed spells currently use the battlefield; do not inherit Hawkshot's policy.
  return world.hero.champion === 'ashe' && !!ABILITIES[ability].minimapTargeting;
}

export function targetedSpell(world: World, ability: Ability): boolean {
  return (
    world.summonerSpell(ability) === 'smite' ||
    (world.hero.champion === 'garen' && ability === 'r') ||
    (world.hero.champion === 'masteryi' && ability === 'q')
  );
}
export function spellTarget(
  world: World,
  ability: Ability,
  target: Unit | undefined
): Unit | undefined {
  return world.summonerSpell(ability) === 'smite'
    ? smiteTarget(world, world.hero, target)
      ? target
      : undefined
    : world.hero.champion === 'masteryi' && ability === 'q'
      ? alphaTarget(world, world.hero, target) &&
        distance(world.hero, target) <= MASTER_YI_Q.castRange
        ? target
        : undefined
      : garenRTarget(world, target);
}
export function targetInstruction(world: World, ability: Ability): string {
  return world.summonerSpell(ability) === 'smite'
    ? `Hold ${ability.toUpperCase()}, point at a large or medium monster or enemy lane minion${world.companions.some((p) => p.ownerId === world.player.id && p.fed >= 15) ? ' or champion' : ''} within 500 range, then release`
    : world.hero.champion === 'masteryi' && ability === 'q'
      ? 'Hold Q, point at a visible enemy within 600 range, then release'
      : 'Hold R, point at an enemy champion in range, then release';
}

/** Input preview only. The queued command is revalidated by the simulation. */
export function garenRTarget(world: World, target: Unit | undefined): Unit | undefined {
  return target &&
    target.kind === 'champion' &&
    target.team !== world.hero.team &&
    world.alive(target) &&
    world.visible(target, world.hero.team) &&
    world.targetable(target) &&
    distance(world.hero, target) <= GAREN_R.castRange
    ? target
    : undefined;
}

export function garenRecastLockTicks(world: World): number {
  return world.hero.champion === 'garen' && world.player.garenE
    ? Math.max(0, world.player.garenE.startTick + GAREN_E_RECAST_TICKS - world.tick)
    : 0;
}
