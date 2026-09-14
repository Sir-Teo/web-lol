import { LUX_BASIC_CRESCENT } from './lux-basic-crescent';
import { LUX_BASIC_TRAIL } from './lux-basic-trail';
import { LUX_BASIC_HOOP_APPEARANCE } from './lux-basic-lookups';

/** Absent particleLingerType=0 and emitterLinger=0 use the pinned schema defaults.
 * Type 0 caps TOTAL particle life at a system stop; it does not extend from impact.
 */
export const LUX_BASIC_LINGER = {
  crescent: {
    type: 0,
    emitterLinger: 0,
    particleLinger: 10.600000381469727,
    nominalLife: LUX_BASIC_CRESCENT.particleLife,
    maxNaturalLife: LUX_BASIC_CRESCENT.particleLife,
  },
  trail: {
    type: 0,
    emitterLinger: 0,
    particleLinger: 0.5,
    nominalLife: LUX_BASIC_TRAIL.particleLife,
    maxNaturalLife: LUX_BASIC_TRAIL.particleLife,
  },
  hoop: {
    type: 0,
    emitterLinger: 0,
    particleLinger: 1,
    nominalLife: LUX_BASIC_HOOP_APPEARANCE.nominalLifetime,
    maxNaturalLife:
      LUX_BASIC_HOOP_APPEARANCE.nominalLifetime * LUX_BASIC_HOOP_APPEARANCE.maxLifetimeFactor,
  },
} as const;
export type LuxBasicEmitter = keyof typeof LUX_BASIC_LINGER;

export function luxBasicParticleLife(
  emitter: LuxBasicEmitter,
  naturalLife: number,
  stopped: boolean
) {
  if (!stopped) return naturalLife;
  const policy = LUX_BASIC_LINGER[emitter];
  // The engine's complex-emitter cap is nominal particle lifetime plus 10 seconds.
  return Math.min(naturalLife, policy.particleLinger, policy.nominalLife + 10);
}
