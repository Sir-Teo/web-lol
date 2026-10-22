import timing from './oracle-presentation.json';
import { ORACLE_AUDIO_END_TICKS } from './oracle-audio-timing';
export const ORACLE_PRESENTATION = timing;
export const ORACLE_VISUAL_TAIL_TICKS = Math.max(
  timing.buffLingerTicks,
  timing.parentLingerTicks + timing.childTailTicks
);
export const ORACLE_PRESENTATION_TAIL_TICKS = Math.max(
  ORACLE_VISUAL_TAIL_TICKS,
  timing.parentLingerTicks + ORACLE_AUDIO_END_TICKS
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
/** Audio's ending outlives the particles; keep the same saved child anchor. */
export function oraclePresentationEndTick(startTick: number, stopTick: number): number {
  const child = oracleChildTick(startTick, stopTick);
  return child === null
    ? stopTick
    : Math.max(oracleVisualEndTick(startTick, stopTick), child + ORACLE_AUDIO_END_TICKS);
}
