import { JUNGLE_BOT_POLICY as P } from '../content/bot-roles';
import { RIFT_CAMPS, type RiftCampId } from '../content/rift-camps';
import { distance, type Vec2 } from './math';
import type { Team, ChampionState } from './types';

export interface JungleBotState {
  camp: RiftCampId | null;
  cursor: number;
  quietSince: number;
  observations: { camp: RiftCampId; seenTick: number; retryTick: number }[];
}
export function jungleRoute(team: Team) {
  const prefix = team === 'blue' ? 'order' : 'chaos';
  return P.route.map((kind) => RIFT_CAMPS.find((c) => c.id === `${prefix}-${kind}`)!);
}
export function assignRole(
  state: ChampionState,
  role: NonNullable<ChampionState['role']>,
  tick = 0
) {
  state.role = role;
  state.jungle =
    role === 'jungle' ? { camp: null, cursor: 0, quietSince: tick, observations: [] } : null;
}
export interface ObservedCampMonster extends Vec2 {
  id: number;
  camp: RiftCampId;
  targetable: boolean;
}
interface JungleObservation {
  tick: number;
  team: Team;
  actor: Vec2;
  /** Only living, team-visible monsters; no hidden IDs, health or respawn clocks. */
  monsters: readonly ObservedCampMonster[];
  visibleHomes: ReadonlySet<RiftCampId>;
}
/** Scout known map locations and retain only observed empty-camp facts. The
 * public initial calendar is known; actual camp respawn deadlines are not input.
 * A quiet window protects delayed Krug children and temporary target loss. */
export function jungleDecision(
  state: JungleBotState,
  observed: JungleObservation
): { type: 'move'; point: Vec2 } | { type: 'attack'; target: number } | { type: 'wait' } {
  const route = jungleRoute(observed.team);
  if (!state.camp) {
    let selected = -1;
    for (let n = 0; n < route.length; n++) {
      const i = (state.cursor + n) % route.length,
        c = route[i];
      const memory = state.observations.find((o) => o.camp === c.id);
      if ((memory?.retryTick ?? 0) <= observed.tick) {
        selected = i;
        break;
      }
    }
    if (selected < 0) return { type: 'wait' };
    state.cursor = selected;
    state.camp = route[selected].id as RiftCampId;
    state.quietSince = observed.tick;
  }
  const camp = route[state.cursor];
  const monsters = observed.monsters.filter((m) => m.camp === camp.id);
  if (monsters.length) state.quietSince = observed.tick;
  if (distance(observed.actor, camp.point) > P.approachRadius)
    return { type: 'move', point: camp.point };
  const target = monsters
    .filter((m) => m.targetable)
    .sort((a, b) => distance(observed.actor, a) - distance(observed.actor, b) || a.id - b.id)[0];
  if (target) return { type: 'attack', target: target.id };
  if (
    !monsters.length &&
    observed.tick >= camp.firstReadyTick &&
    observed.visibleHomes.has(camp.id as RiftCampId) &&
    observed.tick - state.quietSince >= Math.max(P.quietTicks, camp.splitDelayTicks + 36)
  ) {
    state.observations = state.observations.filter((o) => o.camp !== camp.id);
    state.observations.push({
      camp: camp.id as RiftCampId,
      seenTick: observed.tick,
      retryTick: observed.tick + P.scoutRetryTicks,
    });
    state.camp = null;
    state.cursor = (state.cursor + 1) % route.length;
  }
  return { type: 'wait' };
}
