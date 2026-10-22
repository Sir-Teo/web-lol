import { TRINKETS, trinketScaling, type TrinketKind } from '../content/trinkets';
import { WARD_SOURCE, WARD_POLICY } from '../content/warding-totem';
import { distance } from './math';
import type { TrinketState, Unit } from './types';
import type { World } from './world';

export function newTrinket(tick = 0): TrinketState {
  const duration = trinketScaling('ward', 1).rechargeTicks;
  return {
    kind: 'ward',
    createdTick: tick,
    charges: WARD_POLICY.initialCharges,
    rechargeStartTick: tick,
    rechargeEndTick: tick + duration,
    rechargeDurationTicks: duration,
    rechargeStartProgress: 0,
    cooldownTick: 0,
    order: null,
    scan: null,
  };
}
export function resetTrinket(s: TrinketState): void {
  s.charges = WARD_SOURCE.maxCharges;
  s.rechargeStartTick = s.rechargeEndTick = s.rechargeDurationTicks = null;
  s.rechargeStartProgress = 0;
  s.cooldownTick = 0;
}
export function averageChampionLevel(w: World): number {
  const champions = w.units.filter((u) => u.kind === 'champion');
  return (
    champions.reduce((sum, u) => sum + w.championState(u.id)!.level, 0) /
    Math.max(1, champions.length)
  );
}
export function rechargeProgress(s: TrinketState, tick: number): number {
  return s.rechargeStartTick === null
    ? 0
    : Math.min(
        1,
        s.rechargeStartProgress + Math.max(0, tick - s.rechargeStartTick) / s.rechargeDurationTicks!
      );
}
function startRecharge(w: World, s: TrinketState, tick: number, progress = 0): void {
  const duration = trinketScaling(s.kind, averageChampionLevel(w)).rechargeTicks;
  s.rechargeStartTick = tick;
  s.rechargeDurationTicks = duration;
  s.rechargeStartProgress = progress;
  s.rechargeEndTick = tick + Math.ceil((1 - progress) * duration);
}
export function spendTrinket(w: World, s: TrinketState): void {
  if (s.charges === WARD_SOURCE.maxCharges) startRecharge(w, s, w.tick);
  s.charges--;
}
export function advanceTrinket(w: World, u: Unit, s: TrinketState): void {
  while (s.rechargeEndTick !== null && w.tick >= s.rechargeEndTick) {
    const tick = s.rechargeEndTick;
    s.charges++;
    if (s.charges === WARD_SOURCE.maxCharges) {
      s.rechargeStartTick = s.rechargeEndTick = s.rechargeDurationTicks = null;
      s.rechargeStartProgress = 0;
    } else startRecharge(w, s, tick);
  }
  if (!w.alive(u)) s.order = null;
  if (s.scan && s.scan.endTick <= w.tick) s.scan = null;
  // Cleanup precedes unit combat: a Nexus kill can return before scan sampling.
  if (s.scan) {
    if (s.scan.pulseStartTick === null) s.scan.nextPulseTick = w.tick;
    s.scan.echoes = s.scan.echoes.filter((e) => e.endTick > w.tick);
  }
}
export function trinketError(w: World, u: Unit, kind: TrinketKind): string | null {
  const s = w.championState(u.id)?.trinket;
  if (!s || u.kind !== 'champion') return 'Only champions can use trinkets';
  if (s.kind !== kind) return `${TRINKETS[kind].name} is not equipped`;
  if (w.winner || !w.alive(u)) return 'Cannot use a trinket while dead';
  if (u.stunUntil > w.tick) return 'Cannot use a trinket while stunned';
  if (s.charges === 0) return `${TRINKETS[kind].name} has no charges`;
  if (s.cooldownTick > w.tick) return `${TRINKETS[kind].name} is cooling down`;
  return null;
}
export function trinketSwapError(
  w: World,
  kind: TrinketKind,
  ownerId = w.player.id
): string | null {
  if (w.winner) return 'The game has ended';
  const u = w.unit(ownerId),
    s = w.championState(ownerId)?.trinket;
  if (!u || u.kind !== 'champion' || !s) return 'Unknown champion';
  if (!Object.hasOwn(TRINKETS, kind)) return 'Unknown trinket';
  if (s.kind === kind) return `${TRINKETS[kind].name} is already equipped`;
  if (w.alive(u) && distance(u, w.battlefield.spawns[u.team]) > 400)
    return 'Return to your fountain to swap trinkets';
  return null;
}
export function swapTrinket(w: World, kind: TrinketKind, ownerId = w.player.id): string | null {
  const error = trinketSwapError(w, kind, ownerId);
  if (error) return error;
  const u = w.unit(ownerId)!,
    s = w.championState(ownerId)!.trinket;
  advanceTrinket(w, u, s);
  const progress = rechargeProgress(s, w.tick);
  if (s.order) w.setOrder(u, { type: 'idle' });
  s.kind = kind;
  s.order = null;
  // Local swap adapter: conserve stock and fractional completed work. Ceil
  // prevents a shortened deadline from manufacturing a charge via repeated swaps.
  if (s.rechargeEndTick !== null) startRecharge(w, s, w.tick, progress);
  return null;
}
