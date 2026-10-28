import type { World } from '../simulation/world';
import type { Unit } from '../simulation/types';
import type { TeamGoalKind } from '../simulation/bot-team';

const GOAL_LABELS = {
  defend: 'Defending',
  push: 'Pushing',
  gank: 'Ganking',
  river: 'Contesting river',
  advance: 'Advancing',
} satisfies Record<TeamGoalKind, string>;

/** Friendly plans only. Do not read an opponent's owner record or team plan. */
export function alliedChampionIntent(world: World, unit: Unit): string | null {
  if (
    world.matchMode !== 'lanes' ||
    world.winner ||
    unit.kind !== 'champion' ||
    unit.team !== world.hero.team ||
    unit.id === world.player.id ||
    !unit.ai ||
    !world.alive(unit)
  )
    return null;
  const owner = world.championState(unit.id);
  if (!owner) return null;
  if (owner.recallEnd !== null && owner.recallEnd > world.tick) return 'Recalling';
  if (unit.aiRetreating) return 'Retreating';
  const goal = world.teamPlans?.[unit.team].assignments.find(
    (entry) => entry.unitId === unit.id && entry.expiresTick > world.tick
  );
  return goal ? GOAL_LABELS[goal.kind] : null;
}
