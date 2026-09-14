import { HAWKSHOT_ATTENUATION } from '../content/hawkshot-attenuation';
import { wwise145Attenuation } from './wwise145-attenuation';

/** Pinned source curve; native listener mapping remains uncalibrated. */
export function hawkshotAttenuation(distance: number): { db: number; amplitude: number } {
  return wwise145Attenuation(HAWKSHOT_ATTENUATION.points, distance);
}
