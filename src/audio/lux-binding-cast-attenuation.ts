import { LUX_BINDING_ATTENUATION } from '../content/lux-binding-attenuation';
import { LUX_BINDING_CAST_AUDIO } from '../content/lux-binding-cast-audio';
import { wwise145Attenuation } from './wwise145-attenuation';

/** Distance attenuation and container makeup gain, before unresolved bus/master mix.
 * Distance is in source units; native listener placement is not established here. */
export function luxBindingCastAttenuation(distance: number) {
  const attenuation = wwise145Attenuation(LUX_BINDING_ATTENUATION.points, distance);
  return {
    attenuationDb: attenuation.db,
    db: attenuation.db + LUX_BINDING_CAST_AUDIO.gainDb,
    amplitude: attenuation.amplitude * 10 ** (LUX_BINDING_CAST_AUDIO.gainDb / 20),
  };
}
