import durations from './mobile-clip-durations.json';
import type { Unit } from '../simulation/types';
export function mobileClipDurations(
  unit: Pick<Unit, 'kind' | 'champion' | 'team'>
): Readonly<Record<string, number>> | undefined {
  const key = unit.kind === 'champion' ? `${unit.champion}-base` : `${unit.team}-${unit.kind}`;
  return durations[key as keyof typeof durations];
}
