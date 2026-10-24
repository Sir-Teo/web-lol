import { ZENITH_PROFILES } from './leona-zenith-particles';

/** The sword uses the separately verified conditional SCB rim-only adapter.
 * Sound has no visible draw; skin and ribbons retain their separate renderers. */
export function zenithSurfaceAccepted(index: number) {
  const p = ZENITH_PROFILES[index];
  return (
    p.role !== 'sound' &&
    (!p.reflection || index === 18) &&
    ['quad', 'billboard', 'mesh'].includes(p.kind)
  );
}
