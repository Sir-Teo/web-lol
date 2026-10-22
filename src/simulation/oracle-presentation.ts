import {
  oracleChildTick,
  oraclePresentationEndTick,
  ORACLE_PRESENTATION,
} from '../content/oracle-presentation';
import type { TrinketState, OracleVisual } from './types';
import type { World } from './world';

export function finishOracleVisual(
  s: TrinketState,
  tick: number,
  reason: NonNullable<OracleVisual['endReason']>
): void {
  const visual = s.visuals.find((v) => v.stopTick === null);
  if (!visual) return;
  visual.stopTick = tick;
  visual.endReason = reason;
  // A canceled first-update birth has no visible particles or child. Coalescing
  // these presentations also makes repeated practice casts in one tick seekable.
  if (tick <= visual.startTick + ORACLE_PRESENTATION.parentFirstBirthTick)
    s.visuals = s.visuals.filter((v) => v !== visual);
}
/** Capture after unit movement/combat, including an early match-ending hit. */
export function advanceOracleVisuals(w: World): void {
  for (const owner of w.units) {
    const s = w.championState(owner.id)?.trinket;
    if (!s) continue;
    s.visuals = s.visuals.filter(
      (v) => v.stopTick === null || w.tick < oraclePresentationEndTick(v.startTick, v.stopTick)
    );
    for (const v of s.visuals) {
      if (v.stopTick === null || v.childAnchor) continue;
      const child = oracleChildTick(v.startTick, v.stopTick);
      if (child !== null && child <= w.tick)
        v.childAnchor = { point: { x: owner.x, y: owner.y }, facing: owner.facing };
    }
  }
}
