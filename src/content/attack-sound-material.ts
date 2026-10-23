import materials from './attack-sound-materials.json';
import { impactTargetRig } from './impact-target';
import type { Unit } from '../simulation/types';
export type AttackSoundMaterial = 'Flesh' | 'Metal' | 'Stone' | 'Wood';
export function attackSoundRig(
  unit: Pick<Unit, 'kind' | 'champion' | 'team' | 'monster'>
): string | null {
  return unit.kind === 'ward' ? 'sightward-base' : impactTargetRig(unit);
}
/** Frozen skin armorMaterial selects a hashed source switch. Unknown/dummy rigs
 * use the bank's explicit Flesh default; native dispatch remains unverified. */
export function attackSoundMaterialForRig(rig: string | null): AttackSoundMaterial {
  return (
    rig && Object.hasOwn(materials, rig) ? materials[rig as keyof typeof materials] : 'Flesh'
  ) as AttackSoundMaterial;
}
export function attackSoundMaterial(unit: Pick<Unit, 'kind' | 'champion' | 'team' | 'monster'>) {
  return attackSoundMaterialForRig(attackSoundRig(unit));
}
