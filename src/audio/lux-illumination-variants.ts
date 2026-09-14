import { LUX_ILLUMINATION_AUDIO } from '../content/lux-illumination-audio';
import { SourceAudioVariants } from './source-audio-variants';
export class LuxIlluminationVariants extends SourceAudioVariants {
  constructor() {
    super(LUX_ILLUMINATION_AUDIO.variants.length, LUX_ILLUMINATION_AUDIO.policy.wAvoidRepeatCount);
  }
}
