/** Local presentation retention after the final fire ends: maximum authored
 * particle lifetime (4s) plus maximum emitter linger (1s). Particle linger caps
 * an existing particle's total lifetime; it is not added to that lifetime. */
export const AHRI_W_VISUAL_HISTORY_TICKS = 5 * 60;
