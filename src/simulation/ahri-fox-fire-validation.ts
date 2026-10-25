import { AHRI_W } from '../content/ahri-w';
import { AHRI_W_POLICY } from '../content/ahri-w-policy';
import { foxFireOrbitPoint, type FoxFireCast } from './ahri-fox-fires';
import { distance } from './math';
import { isLaneMinionKind, type Unit } from './types';

type Source = Pick<Unit, 'id' | 'champion' | 'team' | 'kind' | 'x' | 'y' | 'deadAt'>;
type Owner = {
  id: number;
  spellRanks: { w: number };
  pendingCast: {
    ability: string;
    rank: number;
    startTick: number;
    releaseTick: number;
    damage: number;
  } | null;
};

export function validateFoxFireCasts(
  casts: readonly FoxFireCast[],
  units: readonly Source[],
  owners: readonly Owner[],
  tick: number,
  nextId: number,
  winner: unknown
): void {
  const fail = () => {
    throw new Error('Saved match contains invalid Fox-Fire state.');
  };
  for (const cast of casts) {
    const source = units.find((unit) => unit.id === cast.sourceId);
    const owner = owners.find((state) => state.id === cast.sourceId);
    if (
      !source ||
      !owner ||
      source.champion !== 'ahri' ||
      source.team !== cast.team ||
      cast.rank > owner.spellRanks.w ||
      cast.startTick > tick ||
      cast.lastTick !== tick ||
      cast.releaseTick !== cast.startTick + AHRI_W_POLICY.windupTicks ||
      cast.released !== tick >= cast.releaseTick ||
      winner !== null ||
      cast.damage < AHRI_W.damageByRank[cast.rank - 1] ||
      (source.deadAt !== null) !== (cast.stopTick !== null) ||
      (cast.stopTick !== null &&
        (cast.stopTick !== source.deadAt ||
          cast.stopTick < cast.startTick ||
          cast.stopTick > tick)) ||
      cast.fires.length !== AHRI_W.clientFireCount
    )
      fail();
    if (
      !cast.released &&
      (owner!.pendingCast?.ability !== 'w' ||
        owner!.pendingCast.startTick !== cast.startTick ||
        owner!.pendingCast.rank !== cast.rank ||
        owner!.pendingCast.damage !== cast.damage ||
        owner!.pendingCast.releaseTick !== cast.releaseTick)
    )
      fail();
    for (const [index, fire] of cast.fires.entries()) {
      if (
        fire.index !== index ||
        (fire.dispatchTick === null) !== (fire.targetId === null) ||
        (fire.targetId !== null &&
          (fire.targetId >= nextId ||
            units.some(
              (unit) =>
                unit.id === fire.targetId &&
                (unit.team === cast.team ||
                  ['ward', 'turret', 'nexus', 'inhibitor'].includes(unit.kind))
            ))) ||
        (fire.dispatchTick !== null &&
          (!cast.released ||
            fire.dispatchTick < cast.releaseTick ||
            fire.dispatchTick < cast.startTick + AHRI_W_POLICY.priorityDelayTicks ||
            fire.dispatchTick > tick ||
            fire.dispatchTick >= cast.startTick + AHRI_W_POLICY.orbitTicks))
      )
        fail();
      if (fire.phase === 'orbit') {
        if (
          cast.stopTick !== null ||
          fire.dispatchTick !== null ||
          fire.stopTick !== null ||
          fire.stopReason !== null ||
          fire.hit !== null ||
          tick >= cast.startTick + AHRI_W_POLICY.orbitTicks ||
          distance(fire.position, foxFireOrbitPoint(cast, index, tick, source!)) > 1e-6
        )
          fail();
      } else if (fire.phase === 'flight') {
        if (
          fire.dispatchTick === null ||
          fire.stopTick !== null ||
          fire.stopReason !== null ||
          fire.hit !== null ||
          tick - fire.dispatchTick >= AHRI_W_POLICY.maximumFlightTicks ||
          distance(fire.previous, fire.position) > AHRI_W.damageSplineSpeed / 60 + 1e-6
        )
          fail();
      } else {
        if (
          fire.stopTick === null ||
          fire.stopReason === null ||
          fire.stopTick < cast.startTick ||
          fire.stopTick > tick ||
          (fire.dispatchTick !== null && fire.stopTick < fire.dispatchTick) ||
          (fire.stopReason === 'hit') !== (fire.hit !== null)
        )
          fail();
        if (
          fire.stopReason === 'death' &&
          (fire.dispatchTick !== null || cast.stopTick !== fire.stopTick)
        )
          fail();
        if (fire.stopReason === 'lost-target' && fire.dispatchTick === null) fail();
        if (
          fire.stopReason === 'expired' &&
          fire.stopTick !==
            (fire.dispatchTick === null
              ? cast.startTick + AHRI_W_POLICY.orbitTicks
              : fire.dispatchTick + AHRI_W_POLICY.maximumFlightTicks)
        )
          fail();
        if (fire.hit) {
          if (fire.targetId === null || fire.dispatchTick === null) fail();
          const repeat = cast.fires.some(
            (other) =>
              other !== fire &&
              other.targetId === fire.targetId &&
              other.stopReason === 'hit' &&
              (other.stopTick! < fire.stopTick! ||
                (other.stopTick === fire.stopTick && other.index < fire.index))
          );
          const target = units.find((unit) => unit.id === fire.targetId);
          if (
            fire.hit.repeat !== repeat ||
            (fire.hit.minionBonus && target && !isLaneMinionKind(target.kind))
          )
            fail();
        }
      }
    }
    if (
      cast.fires.every((fire) => fire.phase === 'spent') &&
      (cast.stopTick !== null || tick >= cast.startTick + AHRI_W_POLICY.movementTicks)
    )
      fail();
  }
}
