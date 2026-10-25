import { LEONA_SUNLIGHT_AUDIO } from '../content/leona-sunlight-audio';
import type { SunlightVisual } from '../simulation/sunlight-visuals';
import { FiniteSourceAudio } from './finite-source-audio';
import { leonaSunlightAudioStates } from './leona-sunlight-state';
export class LeonaSunlightAudio extends FiniteSourceAudio<'hit', SunlightVisual> {
  constructor() {
    super(LEONA_SUNLIGHT_AUDIO, ['hit'], leonaSunlightAudioStates, 'Leona Sunlight');
  }
}
