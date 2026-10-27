import { captureHighlanderKill } from './masteryi-highlander-kill';
import { MASTER_YI_R } from '../content/masteryi-r';
import { TICK_RATE } from '../content/rules';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';

export interface HighlanderState {
  startTick: number;
  endTick: number;
  rank: number;
  pausedTicks: number;
  extensionCount: number;
  takedownsAtCast: number;
  lastExtensionTick: number | null;
}
export const HIGHLANDER_TICKS = MASTER_YI_R.durationSeconds * TICK_RATE;
export const HIGHLANDER_EXTENSION_TICKS = MASTER_YI_R.killAssistExtensionSeconds * TICK_RATE;

export function activeHighlander(owner: ChampionState | undefined, tick: number) {
  const buff = owner?.highlander;
  return buff && buff.startTick <= tick && tick < buff.endTick ? buff : null;
}

/** Called once for each actually awarded champion kill/assist, after its score
 * increments. Local quantization rounds the remaining fraction up; the frozen
 * float is retained, so an exact 100-tick cooldown leaves 31 ticks, not 30.
 * Passive refund also applies posthumously; only a live active buff extends. */
export function highlanderTakedown(
  world: World,
  unit: Unit,
  owner: ChampionState,
  victim: Unit
): void {
  if (unit.champion !== 'masteryi' || !owner.spellRanks.r) return;
  for (const ability of ['q', 'w', 'e'] as const) {
    const remaining = owner.cooldowns[ability] - world.tick;
    if (remaining > 0)
      owner.cooldowns[ability] =
        world.tick + Math.ceil(remaining * (1 - MASTER_YI_R.basicCooldownRefundFraction));
  }
  const buff = activeHighlander(owner, world.tick);
  if (buff && unit.hp > 0 && !world.winner) {
    buff.endTick += HIGHLANDER_EXTENSION_TICKS;
    buff.extensionCount++;
    buff.lastExtensionTick = world.tick;
    captureHighlanderKill(world, unit, owner, victim);
  }
}

export function validateHighlanders(
  owners: readonly Pick<ChampionState, 'id' | 'spellRanks' | 'highlander' | 'kills' | 'assists'>[],
  units: readonly Unit[],
  tick: number,
  winner: Team | null
): void {
  for (const owner of owners) {
    const buff = owner.highlander;
    if (!buff) continue;
    const unit = units.find((u) => u.id === owner.id);
    if (
      !unit ||
      unit.champion !== 'masteryi' ||
      unit.hp <= 0 ||
      winner !== null ||
      buff.rank > owner.spellRanks.r ||
      buff.startTick > tick ||
      buff.endTick <= tick ||
      buff.pausedTicks > tick - buff.startTick ||
      buff.takedownsAtCast + buff.extensionCount !== owner.kills + owner.assists ||
      buff.endTick !==
        buff.startTick +
          HIGHLANDER_TICKS +
          buff.extensionCount * HIGHLANDER_EXTENSION_TICKS +
          buff.pausedTicks ||
      (buff.lastExtensionTick === null) !== (buff.extensionCount === 0) ||
      (buff.lastExtensionTick !== null &&
        (buff.lastExtensionTick < buff.startTick || buff.lastExtensionTick > tick))
    )
      throw new Error('Saved match contains invalid Highlander empowerment.');
  }
}
