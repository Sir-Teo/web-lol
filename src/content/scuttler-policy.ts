import source from './scuttler.json';
import { TICK_RATE } from './rules';
/** Explicit local adapters; source evidence stays separate in scuttler.json. */
export const SCUTTLER_POLICY = {
  firstReadyTick: source.firstReadyBaselineSeconds * TICK_RATE,
  leadupTicks: Math.round(source.camps[0].legacyLeadupSeconds * TICK_RATE),
  untargetableEmergenceTicks: source.rootUntargetableSpawnSeconds * TICK_RATE,
  hiddenTicks: Math.round(
    (source.camps[0].legacyLeadupSeconds - source.rootUntargetableSpawnSeconds) * TICK_RATE
  ),
  respawnTicks: source.camps[0].legacyRespawnSeconds * TICK_RATE,
  sightRadius: 1000,
  thinkTicks: 30,
  fleeTicks: 300,
  grazeTicks: 90,
  fleeDistance: 400,
  regenDelayTicks: 300,
  regenFractionPerSecond: 0.035,
  shrineTicks: 90 * TICK_RATE,
  shrineSpeedFraction: 0.3,
  shrineLingerTicks: 120,
  shrineSpeedRadius: 250,
  shrineSightRadius: 525,
} as const;
export const SCUTTLER_CLIPS = { ...source.clips, run: source.clips.run2 };
export type RiverSide = keyof typeof source.rivers;
export const RIVER_SIDES: readonly RiverSide[] = ['dragon', 'baron'];
export const SCUTTLER_SOURCE = source;
