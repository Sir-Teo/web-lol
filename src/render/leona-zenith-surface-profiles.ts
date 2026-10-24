import { ZENITH_PROFILES } from './leona-zenith-particles';

/** This increment binds only nonreflective surfaces. The sound carrier has no
 * visible draw; skin, ribbons and the reflective sword have separate contracts. */
export function zenithSurfaceAccepted(index: number) {
  const p = ZENITH_PROFILES[index];
  return p.role !== 'sound' && !p.reflection && ['quad', 'billboard', 'mesh'].includes(p.kind);
}
