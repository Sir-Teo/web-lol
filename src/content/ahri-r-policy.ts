import { AHRI_R } from './ahri-r';

/** Local dash/bolt policies. Native geometry, dash scaling, dispatch timing,
 * control precedence and cooldown/recast invocation remain unverified. */
export const AHRI_R_POLICY = {
  recastWindowTicks: Math.round(AHRI_R.recastWindowSeconds * 60),
  recastLockoutTicks: Math.round(AHRI_R.dashCooldownSeconds * 60),
  maximumBoltTicks: 4 * 60,
  endpointBackoff: 10,
  arrivalEpsilon: 1e-8,
  bodyClip: 'spell4',
} as const;
