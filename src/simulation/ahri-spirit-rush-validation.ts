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
  nonUnitIds: readonly number[] = []
): void {
  const fail = () => {
    throw Error('Saved match contains invalid Spirit Rush state.');
  };
  const activeSources = new Set<number>();
  for (const rush of rushes) {
    const source = units.find((u) => u.id === rush.sourceId),
      owner = owners.find((o) => o.id === rush.sourceId),
      last = rush.bursts.at(-1);
    if (
      !source ||
      source.champion !== 'ahri' ||
      !owner ||
      source.team !== rush.team ||
      !owner.spellRanks.r ||
      winner !== null ||
      !last ||
      rush.startTick > tick ||
      rush.endTick !== rush.startTick + POLICY.recastWindowTicks ||
      rush.nextCastTick !== last.startTick + POLICY.recastLockoutTicks ||
      rush.bursts.length > AHRI_R.maxCasts ||
      (rush.stopTick === null) !== (rush.stopReason === null) ||
      (rush.stopTick === null &&
        (source.hp <= 0 ||
          tick >= rush.endTick ||
          rush.remainingCasts !== AHRI_R.maxCasts - rush.bursts.length)) ||
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
