import blue from './blue-sentinel.json';
import red from './red-brambleback.json';
import wolves from './wolf-camps.json';
import raptors from './raptor-camps.json';
import krugs from './krug-camps.json';
import { GROMP, GROMP_POLICY, GROMP_SPAWN_LEADUP_TICKS, GROMP_SPAWN_CLIP_TICKS } from './gromp';
import { TICK_RATE } from './rules';

function packProfile(species: 'wolf' | 'wolf-mini' | 'raptor' | 'raptor-mini') {
  const p =
    species === 'wolf' || species === 'wolf-mini'
      ? wolves.profiles[species]
      : raptors.profiles[species];
  const names = {
    wolf: 'Greater Murk Wolf',
    'wolf-mini': 'Murk Wolf',
    raptor: 'Crimson Raptor',
    'raptor-mini': 'Raptor',
  };
  return {
    ...p,
    name: names[species],
    stats: { ...p.stats, damage: p.localDamage },
    minionScore: p.localMinionScore,
    missileSpeed: 0,
    policy: {
      leashRadius: species.startsWith('wolf') ? wolves.leashRadius : raptors.leashRadius,
      sightRadius: 1000,
      resetHealthFractionPerSecond: 0.2,
      windupTicks: Math.round((p.castFrame / 30) * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / p.stats.attackSpeed),
      corpseLifetimeTicks: Math.ceil(p.clips.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.round(
      (species.startsWith('wolf') ? wolves.leadupSeconds : raptors.camps[0].leadupSeconds) *
        TICK_RATE
    ),
    spawnClipTicks: Math.ceil(p.clips.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  };
}
function krugProfile(species: 'krug' | 'krug-medium' | 'krug-mini') {
  const p = krugs.profiles[species];
  return {
    ...p,
    name: species === 'krug' ? 'Ancient Krug' : species === 'krug-medium' ? 'Krug' : 'Mini Krug',
    stats: { ...p.stats, damage: p.localDamage },
    minionScore: p.localMinionScore,
    missileSpeed: 0,
    policy: {
      leashRadius: krugs.leashRadius,
      sightRadius: 1000,
      resetHealthFractionPerSecond: 0.2,
      windupTicks: Math.round((p.castFrame / 30) * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / p.stats.attackSpeed),
      corpseLifetimeTicks: Math.ceil(p.clips.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.round(krugs.camps[0].leadupSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(p.clips.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  };
}

export const MONSTERS = {
  wolf: packProfile('wolf'),
  'wolf-mini': packProfile('wolf-mini'),
  raptor: packProfile('raptor'),
  'raptor-mini': packProfile('raptor-mini'),
  krug: krugProfile('krug'),
  'krug-medium': krugProfile('krug-medium'),
  'krug-mini': krugProfile('krug-mini'),
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
export type MonsterSpawnClip =
  | 'spawn'
  | 'spawn_mini1'
  | 'spawn_mini2'
  | 'north_spawn'
  | 'spawn2'
  | 'spawn3'
  | 'spawn4'
  | 'north_spawn2'
  | 'north_spawn3'
  | 'north_spawn4'
  | 'spawn_nj'
  | 'spawn_north_jung';
export function monsterSpawnClipTicks(species: MonsterSpecies, clip: MonsterSpawnClip): number {
  const c = (MONSTERS[species].clips as Readonly<Record<string, { durationSeconds: number }>>)[
    clip
  ];
  if (!c) throw new Error('Invalid monster spawn clip.');
  return Math.ceil(c.durationSeconds * TICK_RATE);
}
