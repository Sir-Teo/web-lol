import { stopMeditateBuff } from './masteryi-meditate-buff';
import { MASTER_YI_W } from '../content/masteryi-w';
import { DT, TICK_RATE } from '../content/rules';
import { countDoubleStrikeContact } from './masteryi-double-strike';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';

export interface MeditateState {
  startTick: number;
  endTick: number;
  rank: number;
  power: number;
  lastTick: number;
  nextHealTick: number;
  nextStackTick: number;
  stopTick: number | null;
  stopReason: 'complete' | 'order' | 'control' | 'mana' | null;
}

export const MEDITATE_TICKS = MASTER_YI_W.durationSeconds * TICK_RATE;
export const MEDITATE_HEAL_TICKS = MASTER_YI_W.healTickSeconds * TICK_RATE;
export const MEDITATE_LINGER_TICKS = MASTER_YI_W.reductionLingerSeconds * TICK_RATE;
/** Local interpretation of public interaction text: one stack per second. Native pulse order,
 * continuous mana drain, AP sampling and cancellation remain local policies. */
export const MEDITATE_STACK_TICKS = TICK_RATE;

export function beginMeditate(
  owner: ChampionState,
  tick: number,
  rank: number,
  power: number
): void {
  owner.meditate = {
    startTick: tick,
    endTick: tick + MEDITATE_TICKS,
    rank,
    power,
    lastTick: tick,
    nextHealTick: tick + MEDITATE_HEAL_TICKS,
    nextStackTick: tick + MEDITATE_STACK_TICKS,
    stopTick: null,
    stopReason: null,
  };
  // The body enters its own channel pose; an accepted child contact remains live.
  const child = owner.doubleStrike?.strike;
  if (child && child.poseStopTick === null) child.poseStopTick = tick;
}

export function finishMeditate(
  owner: ChampionState,
  tick: number,
  reason: NonNullable<MeditateState['stopReason']>
): void {
  const channel = owner.meditate;
  if (!channel || channel.stopTick !== null) return;
  channel.stopTick = Math.min(tick, channel.endTick);
  channel.lastTick = channel.stopTick;
  channel.stopReason = reason;
  stopMeditateBuff(owner, channel.stopTick, reason);
}

/** Settle the elapsed channel interval before expiry/input, so a paused E never
 * expires on the same boundary on which the previous interval extended it.
 * Commands then interrupt before this update's heal/stack pulse. */
export function settleMeditate(world: World, owner: ChampionState, unit: Unit): void {
  const channel = owner.meditate;
  if (!channel) return;
  if (channel.stopTick !== null) {
    if (world.tick >= channel.stopTick + MEDITATE_LINGER_TICKS) owner.meditate = null;
    return;
  }
  if (unit.hp <= 0 || world.winner) {
    stopMeditateBuff(owner, world.tick, unit.hp <= 0 ? 'death' : 'victory');
    owner.meditate = null;
    return;
  }
  if (unit.stunUntil > world.tick || unit.silenceUntil > world.tick || unit.charm) {
    finishMeditate(owner, world.tick, 'control');
    return;
  }
  const elapsed = Math.min(world.tick, channel.endTick) - channel.lastTick;
  if (elapsed <= 0) return;
  const mana = unit.maxMana * MASTER_YI_W.maximumManaPerSecond * DT * elapsed;
  channel.lastTick = world.tick;
  if (unit.mana < mana) {
    unit.mana = 0;
    finishMeditate(owner, world.tick, 'mana');
    return;
  }
  unit.mana = Math.max(0, unit.mana - mana);
  for (const buff of [owner.wujuStyle, owner.highlander]) {
    if (buff && buff.startTick < world.tick && buff.endTick >= world.tick) {
      buff.endTick += elapsed;
      buff.pausedTicks += elapsed;
    }
  }
}

/** Committed child contacts run first. A channel owns the remaining unit action,
 * with healing before stack gain and a final pulse at the natural end boundary. */
export function advanceMeditate(world: World, unit: Unit): boolean {
  const owner = world.championState(unit.id)!;
  const channel = owner.meditate;
  if (!channel || channel.stopTick !== null) return false;
  while (channel.nextHealTick <= world.tick && channel.nextHealTick <= channel.endTick) {
    const missing = Math.max(0, (unit.maxHp - unit.hp) / unit.maxHp);
    const total =
      MASTER_YI_W.baseHealByRank[channel.rank - 1] + channel.power * MASTER_YI_W.healCoefficient;
    const amount = Math.min(
      unit.maxHp - unit.hp,
      total *
        (MEDITATE_HEAL_TICKS / MEDITATE_TICKS) *
        (1 + missing * MASTER_YI_W.maximumMissingHealthBonusRatio)
    );
    if (amount > 0) {
      unit.hp += amount;
      world.emit('heal', unit, { unit: unit.id, team: unit.team as Team, value: amount });
    }
    channel.nextHealTick += MEDITATE_HEAL_TICKS;
  }
  while (channel.nextStackTick <= world.tick && channel.nextStackTick <= channel.endTick) {
    if (owner.doubleStrike) countDoubleStrikeContact(owner.doubleStrike, world.tick, false);
    channel.nextStackTick += MEDITATE_STACK_TICKS;
  }
  if (world.tick >= channel.endTick) finishMeditate(owner, world.tick, 'complete');
  return true;
}

export function meditateReduction(
  owner: ChampionState | undefined,
  tick: number,
  turret: boolean
): number {
  const channel = owner?.meditate;
  if (
    !channel ||
    tick < channel.startTick ||
    tick >= (channel.stopTick ?? channel.endTick) + MEDITATE_LINGER_TICKS
  )
    return 0;
  const extra =
    tick < channel.startTick + MASTER_YI_W.initialExtraReductionSeconds * TICK_RATE
      ? MASTER_YI_W.initialExtraReductionByRank[channel.rank - 1]
      : 0;
  return (
    (MASTER_YI_W.damageReductionByRank[channel.rank - 1] + extra) *
    (turret ? MASTER_YI_W.turretReductionMultiplier : 1)
  );
}

export function validateMeditates(
  owners: readonly Pick<ChampionState, 'id' | 'spellRanks' | 'meditate' | 'recallEnd'>[],
  units: readonly Unit[],
  tick: number,
  winner: Team | null
): void {
  for (const owner of owners) {
    const c = owner.meditate;
    if (!c) continue;
    const unit = units.find((u) => u.id === owner.id);
    const at = c.stopTick ?? tick;
    if (
      !unit ||
      unit.champion !== 'masteryi' ||
      unit.hp <= 0 ||
      winner ||
      c.rank > owner.spellRanks.w ||
      c.startTick > at ||
      at > tick ||
      c.endTick !== c.startTick + MEDITATE_TICKS ||
      c.lastTick !== at ||
      (c.stopTick === null) !== (c.stopReason === null) ||
      (c.stopReason === 'complete' && c.stopTick !== c.endTick) ||
      (c.stopTick !== null &&
        (c.stopTick > c.endTick || tick >= c.stopTick + MEDITATE_LINGER_TICKS)) ||
      (c.stopTick === null &&
        (tick >= c.endTick ||
          unit.stunUntil > tick ||
          unit.silenceUntil > tick ||
          !!unit.charm ||
          unit.releaseTick !== null ||
          unit.order.type !== 'idle' ||
          owner.recallEnd !== null)) ||
      c.nextHealTick < at ||
      c.nextHealTick > at + MEDITATE_HEAL_TICKS ||
      c.nextHealTick > c.endTick + MEDITATE_HEAL_TICKS ||
      (c.nextHealTick - c.startTick) % MEDITATE_HEAL_TICKS !== 0 ||
      c.nextHealTick <= c.startTick ||
      c.nextStackTick < at ||
      c.nextStackTick > at + MEDITATE_STACK_TICKS ||
      c.nextStackTick > c.endTick + MEDITATE_STACK_TICKS ||
      (c.nextStackTick - c.startTick) % MEDITATE_STACK_TICKS !== 0 ||
      c.nextStackTick <= c.startTick ||
      (c.stopTick === null && (c.nextHealTick === tick || c.nextStackTick === tick))
    )
      throw new Error('Saved match contains invalid Meditate channel clocks or ownership.');
  }
}
