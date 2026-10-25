import { AHRI_Q } from './ahri-q';

/** Explicit local controller choices, not recovered native execution. The client
 * description supports equal root-calculated magic/true damage on the two legs.
 * Exact integration, width interpretation, endpoint and death behavior are open. */
export const AHRI_Q_POLICY = {
  outwardDistance: AHRI_Q.outward.rawCastRange[0],
  collisionRadius: AHRI_Q.outward.authoredWidth,
  damageAbilityPowerRatio: AHRI_Q.namedStatCoefficient,
  maximumFlightTicks: 8 * 60,
  outwardDamageType: 'magic',
  returnDamageType: 'true',
} as const;
