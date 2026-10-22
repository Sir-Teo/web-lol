import {
  COMPANION_PASSIVES as S,
  COMPANION_PASSIVE_POLICY as P,
  companionStage,
  mosstomperShield,
} from '../content/companion-policy';
import { isStructureKind } from './types';
import { distance } from './math';
import type { OwnedCompanion, Unit } from './types';
import type { World } from './world';

function completed(w: World, id: number) {
  return w.companions.find((p) => p.ownerId === id && companionStage(p.fed) === 2);
}
function grantMossShield(w: World, owner: Unit): void {
  owner.shields = owner.shields.filter((s) => s.companionGrantTick === undefined);
  owner.shields.push({
    sourceId: owner.id,
    amount: mosstomperShield(w.championState(owner.id)!.level),
    endTick: Number.MAX_SAFE_INTEGER,
    companionGrantTick: w.tick,
  });
}
/** Called only by the qualifying large/epic last-hit path, including full growth. */
export function companionPassiveMonsterKill(w: World, p: OwnedCompanion, owner: Unit): void {
  if (companionStage(p.fed) !== 2) return;
  p.passive ??=
    p.kind === 'gustwalker'
      ? { kind: p.kind, lastBrushTick: null, killTick: null }
      : p.kind === 'scorchclaw'
        ? { kind: p.kind, stacks: 0, nextStackTick: w.tick + P.emberIntervalTicks }
        : { kind: p.kind, rechargeTick: null };
  if (p.passive.kind === 'gustwalker') p.passive.killTick = w.alive(owner) ? w.tick : null;
  else if (p.passive.kind === 'scorchclaw') p.passive.stacks = S.scorchclaw.maxStacks;
  else {
    if (w.alive(owner)) grantMossShield(w, owner);
    p.passive.rechargeTick = w.alive(owner) ? null : w.tick + S.mosstomper.rechargeTicks;
  }
}
/** Positive hostile damage counts even when another shield absorbs all of it. */
export function noteCompanionPassiveCombat(w: World, source: Unit, target: Unit): void {
  if (source.team === target.team) return;
  for (const id of new Set([source.id, target.id])) {
    const p = completed(w, id);
    if (p?.passive?.kind === 'mosstomper')
      p.passive.rechargeTick = w.tick + S.mosstomper.rechargeTicks;
  }
}
export function companionMovementBonus(w: World, owner: Unit): number {
  const p = completed(w, owner.id),
    state = p?.passive;
  if (!w.alive(owner) || state?.kind !== 'gustwalker') return 0;
  const decay = (tick: number | null, bonus: number) =>
    tick === null ? 0 : bonus * Math.max(0, 1 - (w.tick - tick) / S.gustwalker.decayTicks);
  return Math.max(
    decay(state.lastBrushTick, S.gustwalker.brushBonus),
    decay(state.killTick, S.gustwalker.killBonus)
  );
}
export function advanceCompanionPassive(w: World, p: OwnedCompanion, owner: Unit): void {
  const state = p.passive;
  if (!state) return;
  if (state.kind === 'scorchclaw') {
    if (w.tick >= state.nextStackTick) {
      const n = Math.floor((w.tick - state.nextStackTick) / P.emberIntervalTicks) + 1;
      state.stacks = Math.min(
        S.scorchclaw.maxStacks,
        state.stacks + n * S.scorchclaw.stacksPerInterval
      );
      state.nextStackTick += n * P.emberIntervalTicks;
    }
  } else if (state.kind === 'gustwalker') {
    if (!w.alive(owner)) {
      state.lastBrushTick = state.killTick = null;
      return;
    }
    if (w.battlefield.inBrush?.(owner)) state.lastBrushTick = w.tick;
    else if (
      state.lastBrushTick !== null &&
      w.tick >= state.lastBrushTick + S.gustwalker.decayTicks
    )
      state.lastBrushTick = null;
    if (state.killTick !== null && w.tick >= state.killTick + S.gustwalker.decayTicks)
      state.killTick = null;
  } else if (w.alive(owner) && state.rechargeTick !== null && w.tick >= state.rechargeTick) {
    grantMossShield(w, owner);
    state.rechargeTick = null;
  }
}
/** Summoners, other procs and companion strikes cannot trigger this attack/spell effect. */
export function triggerScorchclaw(w: World, source: Unit, primary: Unit, category: string): void {
  const p = completed(w, source.id),
    state = p?.passive;
  if (
    primary.kind !== 'champion' ||
    source.team === primary.team ||
    !['direct', 'area'].includes(category) ||
    state?.kind !== 'scorchclaw' ||
    state.stacks !== S.scorchclaw.maxStacks
  )
    return;
  state.stacks = 0;
  for (const target of w.units) {
    if (
      target.team === source.team ||
      !w.alive(target) ||
      !w.vulnerable(target) ||
      isStructureKind(target.kind) ||
      distance(primary, target) > S.scorchclaw.radius ||
      (target.kind === 'monster' && target.monster.phase === 'returning')
    )
      continue;
    w.applySlow(
      source,
      target,
      'scorchclaw',
      S.scorchclaw.slowTicks,
      1 - S.scorchclaw.slowFraction,
      1
    );
    if (!P.aoeBurn && target !== primary) continue;
    const burn = {
      sourceId: source.id,
      startTick: w.tick,
      endTick: w.tick + S.scorchclaw.burnTicks,
      nextTick: w.tick + P.burnIntervalTicks,
      capturedMaxHp: target.maxHp,
      damagePerTick:
        (target.maxHp * S.scorchclaw.healthFraction) /
        (S.scorchclaw.burnTicks / P.burnIntervalTicks),
    };
    const index = target.scorchclawBurns.findIndex((b) => b.sourceId === source.id);
    if (index === -1) target.scorchclawBurns.push(burn);
    else target.scorchclawBurns[index] = burn;
  }
}
/** Four one-second pulses; an already applied burn survives its owner's death. */
export function advanceScorchclawBurns(w: World): void {
  for (const target of w.units) {
    if (!target.scorchclawBurns.length) continue;
    if (!w.alive(target) || (target.kind === 'monster' && target.monster.phase === 'returning')) {
      target.scorchclawBurns = [];
      continue;
    }
    for (const burn of [...target.scorchclawBurns]) {
      const source = w.unit(burn.sourceId);
      if (source && w.tick <= burn.endTick && w.tick >= burn.nextTick) {
        burn.nextTick += P.burnIntervalTicks;
        w.damage(source, target, burn.damagePerTick, 'true', 'companion-passive');
      }
    }
    target.scorchclawBurns = target.scorchclawBurns.filter((b) => b.endTick > w.tick);
  }
}
