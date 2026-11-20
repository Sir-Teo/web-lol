import { MASTER_YI } from './masteryi-progression';
import { MASTER_YI_COMBAT_POLICY } from './masteryi-combat-policy';
import { ASHE } from './ashe-progression';
import { AHRI } from './ahri-progression';
import { AHRI_COMBAT_POLICY } from './ahri-combat-policy';
import { GAREN } from './garen-progression';
import { LUX } from './lux-progression';
import { LEONA } from './leona-progression';
import { LEONA_COMBAT_POLICY } from './leona-combat-policy';
import { ASHE_ATTACK_PROJECTILE_SPEED } from './ashe-projectiles';

/** Explicit supported stat profiles: no fallback to another champion's kit. */
export const CHAMPION_PROFILES = {
  masteryi: {
    ...MASTER_YI,
    name: 'Master Yi',
    windupTicks: MASTER_YI_COMBAT_POLICY.ordinaryWindupTicks,
  },
  ahri: { ...AHRI, name: 'Ahri', windupTicks: AHRI_COMBAT_POLICY.ordinaryWindupTicks },
  ashe: {
    ...ASHE,
    name: 'Ashe',
    speed: 325,
    range: 600,
    windupTicks: 20,
    attackSpeedRatio: ASHE.attackSpeed,
    missileSpeed: ASHE_ATTACK_PROJECTILE_SPEED,
  },
  lux: { ...LUX, name: 'Lux' },
  garen: { ...GAREN, name: 'Garen', missileSpeed: 0 },
  leona: {
    ...LEONA,
    name: 'Leona',
    missileSpeed: 0,
    windupTicks: LEONA_COMBAT_POLICY.ordinaryWindupTicks,
  },
} as const;

export function championProfile(identity: keyof typeof CHAMPION_PROFILES) {
  const profile = CHAMPION_PROFILES[identity];
  if (!profile) throw new RangeError(`Unsupported champion profile: ${identity}`);
  return profile;
}

/** Contact classification follows the integrated attack profile, including new NPCs. */
export function isMeleeChampion(identity: keyof typeof CHAMPION_PROFILES | undefined): boolean {
  return identity !== undefined && CHAMPION_PROFILES[identity].missileSpeed === 0;
}

export const PUBLIC_SELECTABLE_CHAMPIONS = [
  'ashe',
  'lux',
  'garen',
  'masteryi',
  'leona',
  'ahri',
] as const;

export type PublicSelectableChampion = (typeof PUBLIC_SELECTABLE_CHAMPIONS)[number];

/** Public Summoner’s Rift selection across all six integrated Milestone 4 kits. */
export function publicSelectableChampion(
  identity: keyof typeof CHAMPION_PROFILES | undefined
): PublicSelectableChampion {
  if (identity === undefined) return 'ashe';
  if (!Object.hasOwn(CHAMPION_PROFILES, identity))
    throw new RangeError(`Unsupported champion profile: ${identity}`);
  return identity;
}

/** Legacy narrow-trial selection helper retained for isolated trial boundaries. */
export function selectableChampion(
  identity: keyof typeof CHAMPION_PROFILES | undefined
): 'ashe' | 'lux' {
  if (identity === undefined) return 'ashe';
  if (identity === 'garen') throw new Error('Garen player kit is still in development');
  if (identity === 'leona') throw new Error('Leona player kit is still in development');
  if (identity === 'masteryi') throw new Error('Master Yi player kit is still in development');
  if (identity === 'ahri') throw new Error('Ahri player kit is still in development');
  return identity;
}
