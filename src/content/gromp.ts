import profile from './gromp.json';
import { TICK_RATE } from './rules';
import { GROMP_DEATH_PARTICLE_RETENTION_TICKS } from './gromp-death-timing';
export const GROMP = profile;
export const GROMP_SPAWN_LEADUP_TICKS = Math.round(profile.spawn.leadupSeconds * TICK_RATE);
export const GROMP_SPAWN_CLIP_TICKS = Math.round(profile.clips.spawn.durationSeconds * TICK_RATE);
/** Local encounter policies. Full camp activation, level scaling and native
 * leash/reset/attack timing remain separate work. */
export const GROMP_POLICY = {
  leashRadius: 700,
  sightRadius: 1000,
  resetHealthFractionPerSecond: 0.2,
  windupTicks: Math.round((profile.castFrame / 30) * TICK_RATE),
  attackPeriodTicks: Math.round(TICK_RATE / profile.stats.attackSpeed),
  corpseLifetimeTicks: Math.max(
    Math.ceil(profile.clips.death.durationSeconds * TICK_RATE),
    GROMP_DEATH_PARTICLE_RETENTION_TICKS
  ),
} as const;
