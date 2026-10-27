import {
  MASTER_YI_ORDINARY_ATTACKS,
  MASTER_YI_CRITICAL_ATTACK_CLIP,
} from '../content/masteryi-attack-selection';
export type MasterYiAttackKind = 'attack1' | 'attack2' | 'crit';
/** Indexed cosmetic choice from the two declared weights. Native PRNG and graph
 * dispatch are not reconstructed; combat RNG, IDs and attack timing are untouched. */
export function masterYiAttackKind(
  unitId: number,
  startTick: number,
  critical = false
): MasterYiAttackKind {
  if (
    !Number.isSafeInteger(unitId) ||
    unitId <= 0 ||
    !Number.isSafeInteger(startTick) ||
    startTick < 0
  )
    throw RangeError('Invalid primary attack selection identity');
  if (critical) return 'crit';
  let value = Math.imul(unitId ^ Math.imul(startTick, 0x9e3779b9), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 16), 0x846ca68b);
  const chance = ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  return chance < MASTER_YI_ORDINARY_ATTACKS.attack1.probability ? 'attack1' : 'attack2';
}
export function masterYiAttackClip(kind: MasterYiAttackKind): string {
  return kind === 'crit' ? MASTER_YI_CRITICAL_ATTACK_CLIP : MASTER_YI_ORDINARY_ATTACKS[kind].clip;
}
