import { isStructureKind, type Unit } from '../simulation/types';
import type { UnitModel } from './models';

/** Existing local HUD policy, also used for provisional overhead effects. */
export function unitBarHeight(unit: Pick<Unit, 'kind'>, model?: UnitModel) {
  return model?.barHeight ?? (isStructureKind(unit.kind) ? 4.3 : 1.55);
}
