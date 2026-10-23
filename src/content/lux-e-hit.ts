import profiles from './lux-e-particles.json';
/** Source lifetime plus one interpolation endpoint. Native callback anchor and
 * stop/linger need comparison; the authored 10-second linger is not a new tail. */
export const LUX_E_HIT_SECONDS = profiles.find((p) => p.role === 'hit')!.life;
export const LUX_E_HIT_HISTORY_TICKS = Math.ceil(LUX_E_HIT_SECONDS * 60) + 1;
