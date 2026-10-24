import { LEONA_E_AUDIO as P } from '../content/leona-e-audio';
import {
  leonaEAudioStates,
  LEONA_E_AUDIO_KINDS,
  type LeonaEAudioKind,
  type LeonaEAudioRecord,
} from './leona-e-state';
import { FiniteSourceAudio } from './finite-source-audio';
/** Saved Zenith phase adapter for the shared finite source-voice controller. */
export class LeonaZenithAudio extends FiniteSourceAudio<LeonaEAudioKind, LeonaEAudioRecord> {
  constructor() {
    super(P, LEONA_E_AUDIO_KINDS, leonaEAudioStates, 'Zenith');
  }
}
