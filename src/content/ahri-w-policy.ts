import { AHRI_W } from './ahri-w';

/** Local interpretation: .25s committed body windup; named delays measured from
 * activation, current ordered attack target gets priority/bonus acquisition.
 * Other targets become eligible after the secondary delay. Native dispatch,
 * priority, threshold comparison and speed curve remain unverified. */
export const AHRI_W_POLICY = {
  windupTicks: Math.round(AHRI_W.authoredCastSeconds * 60),
  priorityDelayTicks: Math.round(AHRI_W.initialDelaySeconds * 60),
  ordinaryDelayTicks: Math.round(AHRI_W.secondaryDelaySeconds * 60),
  movementTicks: Math.round(AHRI_W.movementSpeedSeconds * 60),
  orbitTicks: Math.round(AHRI_W.namedFlameDurationSeconds * 60),
  maximumFlightTicks: 4 * 60,
} as const;
