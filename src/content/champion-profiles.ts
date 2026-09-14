import { ASHE } from './ashe-progression';
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
} as const;

export function championProfile(identity: keyof typeof CHAMPION_PROFILES) {
  const profile = CHAMPION_PROFILES[identity];
  if (!profile) throw new RangeError(`Unsupported champion profile: ${identity}`);
  return profile;
}
