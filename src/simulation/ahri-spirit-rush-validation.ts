import type { AhriEssence } from './ahri-essences';
import { AHRI_PASSIVE_POLICY } from '../content/ahri-passive-policy';
import { AHRI_R } from '../content/ahri-r';
import { AHRI_R_POLICY as POLICY } from '../content/ahri-r-policy';
import { type SpiritRush } from './ahri-spirit-rush';
import { direction, distance } from './math';
import { isStructureKind, type Unit } from './types';

type Owner = { id: number; spellRanks: { r: number } };
export function validateSpiritRushes(
  rushes: readonly SpiritRush[],
  units: readonly Unit[],
  owners: readonly Owner[],
  tick: number,
  nextId: number,
  winner: unknown,
  nonUnitIds: readonly number[] = [],
  essences: readonly AhriEssence[] = []
): void {
  const fail = () => {
    throw Error('Saved match contains invalid Spirit Rush state.');
  };
  const activeSources = new Set<number>();
  const usedEssences = new Set<number>();
  for (const rush of rushes) {
    const source = units.find((u) => u.id === rush.sourceId),
      owner = owners.find((o) => o.id === rush.sourceId),
      last = rush.bursts.at(-1);
    const replay = replaySpiritRush(rush, tick, nextId, units, essences, nonUnitIds);
    for (const reset of rush.resets) {
      if (usedEssences.has(reset.essenceId)) fail();
      usedEssences.add(reset.essenceId);
    }
    if (
      !source ||
      source.champion !== 'ahri' ||
      !owner ||
      source.team !== rush.team ||
      !owner.spellRanks.r ||
      winner !== null ||
      !last ||
      rush.startTick > tick ||
      rush.endTick !== replay.endTick ||
      rush.nextCastTick !== last.startTick + POLICY.recastLockoutTicks ||
      (rush.stopTick === null) !== (rush.stopReason === null) ||
      (rush.stopTick === null &&
        (source.hp <= 0 || tick >= rush.endTick || rush.remainingCasts !== replay.remaining)) ||
      (rush.stopTick !== null &&
        (rush.stopTick < rush.startTick ||
          rush.stopTick > tick ||
          rush.remainingCasts !== 0 ||
          !rush.bursts.some(
            (b) => b.stopTick === null || b.bolts.some((p) => p.stopTick === null)
          ))) ||
      (rush.stopReason === 'expired' && rush.stopTick !== rush.endTick) ||
      (rush.stopReason === 'death' && (source.deadAt !== rush.stopTick || source.hp > 0))
    )
      fail();
    if (rush.stopTick === null) {
      if (activeSources.has(rush.sourceId)) fail();
      activeSources.add(rush.sourceId);
    }
    for (const [index, b] of rush.bursts.entries()) {
      const length = distance(b.origin, b.destination),
        dir = direction(b.origin, b.destination),
        duration = Math.ceil((length - POLICY.arrivalEpsilon) / (AHRI_R.baseDashSpeed / 60));
      if (
        b.index !== index ||
        b.rank > owner!.spellRanks.r ||
        b.damage < AHRI_R.damageByRank[b.rank - 1] ||
        b.startTick < rush.startTick ||
        b.startTick >= rush.endTick ||
        b.startTick > tick ||
        (index === 0
          ? b.startTick !== rush.startTick
          : b.startTick < rush.bursts[index - 1].startTick + POLICY.recastLockoutTicks) ||
        length <= 1e-8 ||
        length > AHRI_R.dashDistance + 1e-8 ||
        b.bolts.length > AHRI_R.maxTargets ||
        (b.stopTick === null) !== (b.stopReason === null) ||
        (b.stopTick === null) !== (b.stopPoint === null) ||
        (b.stopReason === 'control') !== (b.control !== null) ||
        b.lastTick !== (b.stopTick ?? tick)
      )
        fail();
      if (b.stopTick === null) {
        const travel = ((tick - b.startTick + 1) * AHRI_R.baseDashSpeed) / 60;
        if (
          index !== rush.bursts.length - 1 ||
          source!.hp <= 0 ||
          source!.rootUntil > tick ||
          source!.stunUntil > tick ||
          source!.charm ||
          travel >= length - POLICY.arrivalEpsilon ||
          Math.hypot(
            source!.x - b.origin.x - dir.x * travel,
            source!.y - b.origin.y - dir.y * travel
          ) > 1e-6
        )
          fail();
      } else if (
        b.stopTick < b.startTick ||
        b.stopTick > tick ||
        b.stopTick > b.startTick + duration - 1 ||
        (b.stopReason === 'arrived' &&
          (b.stopTick !== b.startTick + duration - 1 ||
            distance(b.stopPoint!, b.destination) > 1e-6)) ||
        (b.stopReason === 'death' && source!.deadAt !== b.stopTick) ||
        (b.control &&
          Math.max(b.control.rootUntil, b.control.stunUntil, b.control.charmUntil) <= b.stopTick)
      )
        fail();
      const targets = new Set<number>();
      for (const [i, p] of b.bolts.entries()) {
        const target = units.find((u) => u.id === p.targetId);
        if (
          p.index !== i ||
          p.targetId >= nextId ||
          nonUnitIds.includes(p.targetId) ||
          p.targetId === rush.sourceId ||
          targets.has(p.targetId) ||
          (target &&
            (target.team === rush.team ||
              target.kind === 'ward' ||
              isStructureKind(target.kind))) ||
          (p.stopTick === null) !== (p.stopReason === null) ||
          (p.stopTick === null &&
            (!target ||
              target.hp <= 0 ||
              (target.kind === 'monster' && target.monster.phase === 'returning') ||
              tick - b.startTick >= POLICY.maximumBoltTicks)) ||
          (p.stopTick !== null &&
            (p.stopTick < b.startTick ||
              p.stopTick > tick ||
              p.stopTick > b.startTick + POLICY.maximumBoltTicks)) ||
          (p.stopReason === 'expired' && p.stopTick !== b.startTick + POLICY.maximumBoltTicks) ||
          distance(p.position, p.previous) > AHRI_R.missile.speed / 60 + 1e-6 ||
          distance(p.position, b.origin) >
            (AHRI_R.missile.speed / 60) * ((p.stopTick ?? tick) - b.startTick + 1) + 1e-6
        )
          fail();
        targets.add(p.targetId);
      }
    }
  }
}

/** Reconstruct charge/window updates in the engine's cast-before-consumption
 * ordering, so a later Essence cannot retroactively legalize an expired cast. */
function replaySpiritRush(
  rush: SpiritRush,
  tick: number,
  nextId: number,
  units: readonly Unit[],
  essences: readonly AhriEssence[],
  nonUnitIds: readonly number[]
) {
  const fail = () => {
    throw Error('Saved match contains invalid Spirit Rush Essence history.');
  };
  let remaining: number = AHRI_R.maxCasts,
    endTick = rush.startTick + POLICY.recastWindowTicks;
  const events = [
    ...rush.bursts.map((b, index) => ({ kind: 'cast' as const, tick: b.startTick, index })),
    ...rush.resets.map((r, index) => ({ kind: 'essence' as const, tick: r.consumeTick, index })),
  ].sort(
    (a, b) =>
      a.tick - b.tick || (a.kind === b.kind ? a.index - b.index : a.kind === 'cast' ? -1 : 1)
  );
  for (const event of events) {
    if (
      event.tick < rush.startTick ||
      event.tick >= endTick ||
      event.tick > tick ||
      (rush.stopTick !== null && event.tick > rush.stopTick)
    )
      fail();
    if (event.kind === 'cast') {
      if (remaining <= 0) fail();
      remaining--;
      continue;
    }
    const r = rush.resets[event.index],
      soul = essences.find((e) => e.id === r.essenceId),
      victim = units.find((u) => u.id === r.victimId),
      expectedEnd = Math.max(
        endTick,
        r.consumeTick + Math.round(AHRI_R.passiveDurationExtensionSeconds * 60)
      ),
      expectedRemaining = Math.min(AHRI_R.maxCasts, remaining + AHRI_R.resetCasts);
    if (
      r.essenceId >= nextId ||
      units.some((u) => u.id === r.essenceId) ||
      (nonUnitIds.includes(r.essenceId) && !soul) ||
      !victim ||
      victim.kind !== 'champion' ||
      victim.team === rush.team ||
      r.spawnTick > r.consumeTick ||
      r.consumeTick - r.spawnTick > AHRI_PASSIVE_POLICY.maximumPursuitTicks ||
      (event.index > 0 && r.consumeTick < rush.resets[event.index - 1].consumeTick) ||
      r.previousEndTick !== endTick ||
      r.previousRemaining !== remaining ||
      r.endTick !== expectedEnd ||
      r.remaining !== expectedRemaining ||
      (soul &&
        (soul.sourceId !== rush.sourceId ||
          soul.victimId !== r.victimId ||
          soul.kind !== 'champion' ||
          soul.startTick !== r.spawnTick ||
          soul.stopTick !== r.consumeTick ||
          soul.stopReason !== 'consumed'))
    )
      fail();
    remaining = expectedRemaining;
    endTick = expectedEnd;
  }
  return { remaining, endTick };
}
