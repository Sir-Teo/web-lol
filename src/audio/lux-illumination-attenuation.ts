import { LUX_ILLUMINATION_ATTENUATION } from '../content/lux-illumination-attenuation';
import { LUX_ILLUMINATION_AUDIO } from '../content/lux-illumination-audio';
import { wwise145Attenuation } from './wwise145-attenuation';

/** Distance attenuation and container makeup gain, before unresolved bus/master mix.
 * Distance is in source units; native listener placement is not established here. */
export function luxIlluminationAttenuation(distance: number) {
  const attenuation = wwise145Attenuation(LUX_ILLUMINATION_ATTENUATION.points, distance);
  return {
    attenuationDb: attenuation.db,
    db: attenuation.db + LUX_ILLUMINATION_AUDIO.gainDb,
    amplitude: attenuation.amplitude * 10 ** (LUX_ILLUMINATION_AUDIO.gainDb / 20),
  };
}
