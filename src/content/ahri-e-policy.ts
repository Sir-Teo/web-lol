import { AHRI_E } from './ahri-e';

/** Local first-hit skillshot/forced-walk policies; native CC ordering, masks,
 * tenacity, endpoint/width interpretation and post-death behavior remain open. */
export const AHRI_E_POLICY = {
  windupTicks: Math.round(AHRI_E.castSeconds * 60),
  range: AHRI_E.missile.rawCastRange[0],
  radius: AHRI_E.missile.authoredWidth,
  movementMultiplier: 1 + AHRI_E.negativeSlowPercent,
  bodyClip: 'spell3_north',
} as const;
