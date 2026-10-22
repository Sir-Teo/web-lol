import type { Unit } from '../simulation/types';
import durations from './mobile-clip-durations.json';
import { MONSTERS } from './monsters';
export const MOBILE_CLIP_DURATIONS = {
  'sru-razorbeak-base': Object.fromEntries(
    Object.entries(MONSTERS.raptor.clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  'sru-razorbeakmini-base': Object.fromEntries(
    Object.entries(MONSTERS['raptor-mini'].clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  'sru-murkwolf-base': Object.fromEntries(
    Object.entries(MONSTERS.wolf.clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  'sru-murkwolfmini-base': Object.fromEntries(
    Object.entries(MONSTERS['wolf-mini'].clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  ...durations,
  'sru-gromp-base': Object.fromEntries(
    Object.entries(MONSTERS.gromp.clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  'sru-blue-base': Object.fromEntries(
    Object.entries(MONSTERS.blue.clips).map(([a, c]) => [a, c.durationSeconds])
  ),
  'sru-red-base': Object.fromEntries(
    Object.entries(MONSTERS.red.clips).map(([a, c]) => [a, c.durationSeconds])
  ),
};
export type MobileRig = keyof typeof MOBILE_CLIP_DURATIONS;
export function mobileRig(
  unit: Pick<Unit, 'kind' | 'champion' | 'team' | 'monster'>
): MobileRig | null {
  const key =
    unit.kind === 'monster'
      ? MONSTERS[unit.monster!.species].rig
      : unit.kind === 'champion'
        ? `${unit.champion}-base`
        : `${unit.team}-${unit.kind}`;
  return Object.hasOwn(MOBILE_CLIP_DURATIONS, key) ? (key as MobileRig) : null;
}
export function mobileClipDurations(
  unit: Pick<Unit, 'kind' | 'champion' | 'team' | 'monster'>
): Readonly<Record<string, number>> | undefined {
  const key = mobileRig(unit);
  return key === null ? undefined : MOBILE_CLIP_DURATIONS[key];
}
