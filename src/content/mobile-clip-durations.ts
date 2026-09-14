import type { Unit } from '../simulation/types';
import durations from './mobile-clip-durations.json';
export const MOBILE_CLIP_DURATIONS = durations;
export type MobileRig = keyof typeof durations;
export function mobileRig(unit: Pick<Unit, 'kind' | 'champion' | 'team'>): MobileRig | null {
  const key = unit.kind === 'champion' ? `${unit.champion}-base` : `${unit.team}-${unit.kind}`;
  return Object.hasOwn(durations, key) ? (key as MobileRig) : null;
}
export function mobileClipDurations(
  unit: Pick<Unit, 'kind' | 'champion' | 'team'>
): Readonly<Record<string, number>> | undefined {
  const key = mobileRig(unit);
  return key === null ? undefined : durations[key];
}
