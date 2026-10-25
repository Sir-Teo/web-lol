import { AHRI } from './ahri-progression';

/** Provisional shared simulation timing, not a recovered native animation marker.
 * BIN AD growth 3 is used by this development profile; public client 0 remains
 * unresolved. Ordinary crits use the shared game policy; the raw field is 2. */
export const AHRI_COMBAT_POLICY = {
  ordinaryWindupTicks: Math.round(
    ((0.3 + AHRI.attackDelayCastOffsetPercent) * 60) / AHRI.attackSpeed
  ),
  idleClip: 'idle_var2',
  runClip: 'run_in',
  attackClip: 'attack1',
  criticalClip: 'crit',
  recallClip: 'recall',
} as const;
