import blue from './blue-sentinel.json';
import { GROMP, GROMP_POLICY, GROMP_SPAWN_LEADUP_TICKS, GROMP_SPAWN_CLIP_TICKS } from './gromp';
import { TICK_RATE } from './rules';

export const MONSTERS = {
  gromp: {
    ...GROMP,
    name: 'Gromp',
    rig: 'sru-gromp-base',
    policy: GROMP_POLICY,
    spawnLeadupTicks: GROMP_SPAWN_LEADUP_TICKS,
    spawnClipTicks: GROMP_SPAWN_CLIP_TICKS,
    spawnSubmesh: GROMP.spawn.submesh,
  },
  blue: {
    ...blue,
    name: 'Blue Sentinel',
    stats: { ...blue.stats, range: blue.policy.attackRange },
    missileSpeed: 0,
    policy: {
      ...blue.policy,
      windupTicks: Math.round((blue.castFrame / 30) * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / blue.stats.attackSpeed),
      corpseLifetimeTicks: Math.ceil(blue.clips.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.round(blue.policy.leadupSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(blue.clips.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  },
} as const;
export type MonsterSpecies = keyof typeof MONSTERS;
