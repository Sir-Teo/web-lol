import { LEONA_R_AUDIO as P } from '../content/leona-r-audio';
import { FiniteSourceAudio } from './finite-source-audio';
import {
  leonaRAudioStates,
  LEONA_R_AUDIO_KINDS,
  type LeonaRAudioKind,
  type LeonaRAudioRecord,
} from './leona-r-state';
export class LeonaSolarAudio extends FiniteSourceAudio<LeonaRAudioKind, LeonaRAudioRecord> {
  constructor() {
    super(P, LEONA_R_AUDIO_KINDS, leonaRAudioStates, 'Solar Flare');
  }
}
