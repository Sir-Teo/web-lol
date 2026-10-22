import blue from './blue-sentinel.json';
import red from './red-brambleback.json';
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
  red: {
    ...red,
    name: 'Red Brambleback',
    missileSpeed: 0,
    policy: {
      ...red.policy,
      windupTicks: Math.round((red.castFrame / 30) * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / red.stats.attackSpeed),
      corpseLifetimeTicks: Math.ceil(red.clips.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.round(red.policy.leadupSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(red.clips.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  },
} as const;
export type MonsterSpecies = keyof typeof MONSTERS;
