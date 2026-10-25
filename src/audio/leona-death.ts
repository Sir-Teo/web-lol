import { LEONA_DEATH_AUDIO } from '../content/leona-death-audio';
import { FiniteSourceAudio } from './finite-source-audio';
import {
  LEONA_DEATH_AUDIO_KINDS,
  leonaDeathAudioStates,
  type LeonaDeathAudioKind,
  type LeonaDeathAudioRecord,
} from './leona-death-state';
export class LeonaDeathAudio extends FiniteSourceAudio<LeonaDeathAudioKind, LeonaDeathAudioRecord> {
  constructor() {
    super(LEONA_DEATH_AUDIO, LEONA_DEATH_AUDIO_KINDS, leonaDeathAudioStates, 'Leona death');
  }
}
