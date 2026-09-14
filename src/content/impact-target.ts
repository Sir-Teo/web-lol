import { isStructureKind, type Unit } from '../simulation/types';
import { mobileRig, type MobileRig } from './mobile-clip-durations';
import type { StructureRig } from './structure-animation';
export type ImpactRig = MobileRig | StructureRig;
export function impactTargetRig(unit: Pick<Unit, 'kind' | 'champion' | 'team'>): ImpactRig | null {
  return isStructureKind(unit.kind)
    ? (`${unit.team}-${unit.kind}` as StructureRig)
    : mobileRig(unit);
}
