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

/** Selection remains limited to integrated player kits during roster expansion. */
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
