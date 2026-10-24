import { SOLAR_PROFILES } from './leona-solar-particles';

/** Explicit scope: the weapon buff needs its attachment frame (unit-root
 * placement puts both glows below terrain). Attached skins/planar receivers and
 * the missing base texture stay separate. Modes1/2 use explicit late/early lists. */
export function solarSurfaceAccepted(index: number) {
  const p = SOLAR_PROFILES[index];
  return (
    !!p.texture &&
    p.role !== 'buff' &&
    ['quad', 'billboard', 'mesh', 'ray'].includes(p.kind) &&
    (!p.distortion || p.distortion.mode === 1 || p.distortion.mode === 2)
  );
}
