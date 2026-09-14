import { ASHE } from './ashe-progression';
import { GAREN } from './garen-progression';
import { LUX } from './lux-progression';
import { ASHE_ATTACK_PROJECTILE_SPEED } from './ashe-projectiles';

/** Explicit supported stat profiles: no fallback to another champion's kit. */
export const CHAMPION_PROFILES = {
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
  return identity;
}
