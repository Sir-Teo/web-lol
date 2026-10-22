import timing from './oracle-presentation.json';
export const ORACLE_PRESENTATION = timing;
export const ORACLE_VISUAL_TAIL_TICKS = Math.max(
  timing.buffLingerTicks,
  timing.parentLingerTicks + timing.childTailTicks
);
/** Source parent edge, with local first-update and stop+linger timing. */
export function oracleChildTick(startTick: number, stopTick: number | null): number | null {
  const born = startTick + timing.parentFirstBirthTick;
  if (stopTick !== null && stopTick <= born) return null;
  const natural = born + timing.parentLifeTicks;
  return stopTick === null ? natural : Math.min(natural, stopTick + timing.parentLingerTicks);
}
export function oracleVisualEndTick(startTick: number, stopTick: number): number {
  const child = oracleChildTick(startTick, stopTick);
  return child === null
    ? stopTick
    : Math.max(stopTick + timing.buffLingerTicks, child + timing.childTailTicks);
}
