import { MASTER_YI } from './masteryi-progression';

/** Explicit local development timing/pose selection. The source has no ordinary
 * attack missile specification. Native contact, graph transitions and the
 * source's Double Strike extra attack remain unimplemented. */
export const MASTER_YI_COMBAT_POLICY = {
  ordinaryWindupTicks: Math.round(
    ((0.3 + MASTER_YI.attackDelayCastOffsetPercent) * 60) / MASTER_YI.attackSpeed
  ),
  idleClip: 'entry_56f6d84b',
  runClip: 'run',
  attackClip: 'entry_d5c55cfd',
  criticalClip: 'entry_e1798980',
  recallClip: 'recall_in',
  recallLoopClip: 'recall_loop',
} as const;
