import profiles from './structure-animation-profiles.json';
import type { Unit } from '../simulation/types';
export interface StructureAnimationProfile {
  destroyedClip: string;
  animateDestruction: boolean;
  deadIdleClip: string | null;
  durations: Readonly<Record<string, number>>;
}
export function structureAnimationProfile(
  unit: Pick<Unit, 'kind' | 'team'>
): StructureAnimationProfile {
  const key = `${unit.team}-${unit.kind}`;
  if (!Object.hasOwn(profiles, key)) throw new Error(`Unknown structure animation rig: ${key}`);
  return profiles[key as keyof typeof profiles];
}
