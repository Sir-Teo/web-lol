import { growthAtLevel } from '../simulation/progression';
import { TICK_RATE } from './rules';

/**
 * Epic objective stats and spawn coordinates pinned to `docs/reference/epic-character-source.json`
 * (Riot 16.18.8175716 Map11.wad.client) and `src/content/jungle-map-inspection.json`.
 */
export const DRAGON_ELEMENTS = ['fire', 'earth', 'water', 'air', 'hextech', 'chemtech'] as const;

export type DragonElement = (typeof DRAGON_ELEMENTS)[number];

export const DRAGON_ELEMENT_NAMES: Readonly<Record<DragonElement, string>> = {
  fire: 'Infernal Drake',
  earth: 'Mountain Drake',
  water: 'Ocean Drake',
  air: 'Cloud Drake',
  hextech: 'Hextech Drake',
  chemtech: 'Chemtech Drake',
};

export const DRAGON_SOUL_NAMES: Readonly<Record<DragonElement, string>> = {
  fire: 'Infernal Soul',
  earth: 'Mountain Soul',
  water: 'Ocean Soul',
  air: 'Cloud Soul',
  hextech: 'Hextech Soul',
  chemtech: 'Chemtech Soul',
};

export const DRAGON_PIT_POINT = { x: 2412.673828125, y: 3027.23876953125 } as const;
export const TOP_PIT_POINT = { x: -2515.43505859375, y: -3062.3232421875 } as const;

export const VOIDGRUB_OFFSETS = [
  { x: -95, y: -45 },
  { x: 95, y: -45 },
  { x: 0, y: 85 },
] as const;

export const EPIC_OBJECTIVE_TIMING = {
  dragonFirstReadyTick: 5 * 60 * TICK_RATE,
  dragonRespawnTicks: 5 * 60 * TICK_RATE,
  elderFirstDelayAfterSoulTicks: 6 * 60 * TICK_RATE,
  elderRespawnTicks: 6 * 60 * TICK_RATE,
  elderBuffDurationTicks: 150 * TICK_RATE,
  elderExecuteThreshold: 0.2,
  elderBurnTotalTrueDamage: 150,
  elderBurnDurationTicks: 3 * TICK_RATE,
  voidgrubFirstReadyTick: 6 * 60 * TICK_RATE,
  voidgrubRespawnTicks: 4 * 60 * TICK_RATE,
  voidgrubLastRespawnStartTick: Math.round(13.75 * 60 * TICK_RATE),
  voidgrubDespawnTick: 885 * TICK_RATE, // 14:45 from NeutralCampGeComponentDef StopSpawnTimeSecs
  heraldFirstReadyTick: 15 * 60 * TICK_RATE,
  heraldDespawnTick: 1185 * TICK_RATE, // 19:45 from NeutralCampGeComponentDef StopSpawnTimeSecs
  heraldChargeDurationTicks: 180 * TICK_RATE,
  heraldTurretBaseTrueDamage: 1200,
  heraldTurretMaxHpTrueFraction: 0.15,
  voidTouchStructureTrueDpsPerStack: 4,
  voidTouchDurationTicks: 4 * TICK_RATE,
} as const;

export const DRAGON_SLAYER_BUFFS = {
  fireBonusOffenseFractionPerStack: 0.05,
  earthBonusDefenseFractionPerStack: 0.08,
  waterMissingHpRegenPer5sFractionPerStack: 0.025,
  airBonusMoveSpeedFractionPerStack: 0.035,
  airSlowResistPerStack: 0.05,
  hextechAbilityHastePerStack: 5,
  hextechAttackSpeedPerStack: 0.05,
  chemtechTenacityPerStack: 0.06,
  chemtechHealShieldPowerPerStack: 0.06,
  soulStacksRequired: 4,
  infernalSoulBaseDamage: 100,
  infernalSoulCooldownTicks: 3 * TICK_RATE,
  mountainSoulShieldBase: 220,
  mountainSoulOutOfCombatTicks: 5 * TICK_RATE,
  oceanSoulHealBase: 150,
  oceanSoulManaBase: 60,
  oceanSoulCooldownTicks: 4 * TICK_RATE,
  cloudSoulPassiveSpeedFraction: 0.12,
  cloudSoulUltimateBurstFraction: 0.45,
  cloudSoulUltimateBurstTicks: 6 * TICK_RATE,
  hextechSoulMagicDamage: 85,
  hextechSoulSlowMultiplier: 0.65,
  hextechSoulSlowTicks: 2 * TICK_RATE,
  hextechSoulCooldownTicks: 6 * TICK_RATE,
  chemtechSoulLowHpThreshold: 0.5,
  chemtechSoulBonusDamageMultiplier: 1.11,
  chemtechSoulDamageTakenMultiplier: 0.89,
} as const;

const EPIC_CLIPS = {
  spawn: { name: 'spawn', sourceState: 'Spawn', durationSeconds: 1.2 },
  idle1: { name: 'idle1', sourceState: 'Idle1', durationSeconds: 2.2 },
  run: { name: 'run', sourceState: 'Run', durationSeconds: 1.0 },
  attack1: { name: 'attack1', sourceState: 'Attack1', durationSeconds: 1.1 },
  death: { name: 'death', sourceState: 'Death', durationSeconds: 2.0 },
} as const;

function makeDragonMonster(
  element: DragonElement,
  baseHp: number,
  hpGrowth: number,
  baseDamage: number,
  attackSpeed: number
) {
  return {
    name: DRAGON_ELEMENT_NAMES[element],
    rig: 'sru-dragon-base' as const,
    radius: 125,
    pathfindingRadius: 1,
    healthBarHeight: 195,
    gold: 75,
    teamGold: 25,
    experience: 160,
    minionScore: 4,
    missileSpeed: 1200,
    castFrame: 10.5,
    clips: EPIC_CLIPS,
    stats: {
      maxHp: baseHp,
      mana: 0,
      maxMana: 0,
      damage: baseDamage,
      armor: 34,
      magicResist: 32,
      range: 500,
      speed: 330,
      attackSpeed,
    },
    growth: { maxHp: hpGrowth, armor: 8, magicResist: 4 },
    policy: {
      leashRadius: 1150,
      sightRadius: 1000,
      resetHealthFractionPerSecond: 0.15,
      windupTicks: Math.round(0.35 * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / attackSpeed),
      corpseLifetimeTicks: Math.ceil(EPIC_CLIPS.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  } as const;
}

export const EPIC_MONSTER_PROFILES = {
  'dragon-fire': makeDragonMonster('fire', 3625, 375, 70, 0.5),
  'dragon-earth': makeDragonMonster('earth', 4200, 430, 105, 0.25),
  'dragon-water': makeDragonMonster('water', 3625, 375, 70, 0.5),
  'dragon-air': makeDragonMonster('air', 3625, 375, 35, 1.0),
  'dragon-hextech': makeDragonMonster('hextech', 3625, 375, 47, 0.75),
  'dragon-chemtech': makeDragonMonster('chemtech', 3625, 375, 47, 0.5),
  'elder-dragon': {
    name: 'Elder Dragon',
    rig: 'sru-elder-dragon-base' as const,
    radius: 125,
    pathfindingRadius: 1,
    healthBarHeight: 225,
    gold: 100,
    teamGold: 150,
    experience: 300,
    minionScore: 4,
    missileSpeed: 1400,
    castFrame: 10.5,
    clips: EPIC_CLIPS,
    stats: {
      maxHp: 11500,
      mana: 0,
      maxMana: 0,
      damage: 150,
      armor: 34,
      magicResist: 32,
      range: 500,
      speed: 330,
      attackSpeed: 0.5,
    },
    growth: { maxHp: 575, armor: 8, magicResist: 4 },
    policy: {
      leashRadius: 1150,
      sightRadius: 1000,
      resetHealthFractionPerSecond: 0.15,
      windupTicks: Math.round(0.35 * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / 0.5),
      corpseLifetimeTicks: Math.ceil(EPIC_CLIPS.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  },
  riftherald: {
    name: 'Rift Herald',
    rig: 'sru-riftherald-base' as const,
    radius: 110,
    pathfindingRadius: 110,
    healthBarHeight: 190,
    gold: 100,
    teamGold: 200,
    experience: 240,
    minionScore: 4,
    missileSpeed: 0,
    castFrame: 12.6,
    clips: EPIC_CLIPS,
    stats: {
      maxHp: 7000,
      mana: 0,
      maxMana: 0,
      damage: 130,
      armor: 34,
      magicResist: 32,
      range: 250,
      speed: 325,
      attackSpeed: 0.4,
    },
    growth: { maxHp: 700, damage: 10, armor: 8, magicResist: 4 },
    policy: {
      leashRadius: 1100,
      sightRadius: 1000,
      resetHealthFractionPerSecond: 0.15,
      windupTicks: Math.round(0.42 * TICK_RATE),
      attackPeriodTicks: Math.round(TICK_RATE / 0.4),
      corpseLifetimeTicks: Math.ceil(EPIC_CLIPS.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  },
  voidgrub: {
    name: 'Voidgrub',
    rig: 'sru-voidgrub-base' as const,
    radius: 70,
    pathfindingRadius: 70,
    healthBarHeight: 115,
    gold: 30,
    teamGold: 0,
    experience: 65,
    minionScore: 2,
    missileSpeed: 900,
    castFrame: 7.5,
    clips: EPIC_CLIPS,
    stats: {
      maxHp: 1300,
      mana: 0,
      maxMana: 0,
      damage: 12,
      armor: 34,
      magicResist: 32,
      range: 500,
      speed: 350,
      attackSpeed: 1.0,
    },
    growth: { maxHp: 200, damage: 2, armor: 8, magicResist: 4 },
    policy: {
      leashRadius: 1050,
      sightRadius: 900,
      resetHealthFractionPerSecond: 0.2,
      windupTicks: Math.round(0.25 * TICK_RATE),
      attackPeriodTicks: TICK_RATE,
      corpseLifetimeTicks: Math.ceil(EPIC_CLIPS.death.durationSeconds * TICK_RATE),
    },
    spawnLeadupTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnClipTicks: Math.ceil(EPIC_CLIPS.spawn.durationSeconds * TICK_RATE),
    spawnSubmesh: null,
  },
} as const;

export function scaleEpicMonsterAtLevel(
  species: keyof typeof EPIC_MONSTER_PROFILES,
  averageLevel: number
) {
  const profile = EPIC_MONSTER_PROFILES[species];
  const clamped = Math.max(1, Math.min(18, Math.round(averageLevel)));
  const g = growthAtLevel(clamped);
  const damageGrowth = 'damage' in profile.growth ? profile.growth.damage : 0;
  return {
    maxHp: Math.round(profile.stats.maxHp + profile.growth.maxHp * g),
    damage: Math.round(profile.stats.damage + damageGrowth * g),
    armor: Math.round(profile.stats.armor + profile.growth.armor * g),
    magicResist: Math.round(profile.stats.magicResist + profile.growth.magicResist * g),
  };
}
