import type { Unit } from '../simulation/types';
import durations from './mobile-clip-durations.json';
import { GROMP } from './gromp';
export const MOBILE_CLIP_DURATIONS = {
  ...durations,
  'sru-gromp-base': Object.fromEntries(
    Object.entries(GROMP.clips).map(([alias, c]) => [alias, c.durationSeconds])
  ),
};
export type MobileRig = keyof typeof MOBILE_CLIP_DURATIONS;
export function mobileRig(unit: Pick<Unit, 'kind' | 'champion' | 'team'>): MobileRig | null {
  const key =
    unit.kind === 'monster'
      ? 'sru-gromp-base'
      : unit.kind === 'champion'
        ? `${unit.champion}-base`
        : `${unit.team}-${unit.kind}`;
  return Object.hasOwn(MOBILE_CLIP_DURATIONS, key) ? (key as MobileRig) : null;
}
export function mobileClipDurations(
  unit: Pick<Unit, 'kind' | 'champion' | 'team'>
): Readonly<Record<string, number>> | undefined {
  const key = mobileRig(unit);
  return key === null ? undefined : MOBILE_CLIP_DURATIONS[key];
}
