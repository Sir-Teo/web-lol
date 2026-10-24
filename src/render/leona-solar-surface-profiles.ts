import { SOLAR_PROFILES } from './leona-solar-particles';

/** Explicit scope: the weapon buff needs its attachment frame (unit-root
 * placement puts both glows below terrain). Planar receivers, the missing base
 * texture and early/no-character distortion need their own bindings/stage. */
export function solarSurfaceAccepted(index: number) {
  const p = SOLAR_PROFILES[index];
  return (
    !!p.texture &&
    p.role !== 'buff' &&
    ['quad', 'billboard', 'mesh', 'ray'].includes(p.kind) &&
    (!p.distortion || p.distortion.mode === 1)
  );
}
