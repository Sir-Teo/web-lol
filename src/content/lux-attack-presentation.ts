import { LUX_BASIC_LINGER, luxBasicParticleLife, type LuxBasicEmitter } from './lux-basic-linger';

/** Conservative bound: a particle may be born at the stop tick. Type 0 caps its
 * total life, so the maximum capped natural life covers every surviving tail.
 */
export const LUX_ATTACK_VISUAL_TAIL_TICKS = Math.ceil(
  Math.max(
    ...(Object.keys(LUX_BASIC_LINGER) as LuxBasicEmitter[]).map((key) =>
      luxBasicParticleLife(key, LUX_BASIC_LINGER[key].maxNaturalLife, true)
    )
  ) * 60
);
/** Retain three additional frames for the birth grid and display interpolation. */
export const LUX_ATTACK_PATH_FRAMES = LUX_ATTACK_VISUAL_TAIL_TICKS + 3;
