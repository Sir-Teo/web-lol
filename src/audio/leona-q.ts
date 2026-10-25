import { LEONA_Q_AUDIO as P } from '../content/leona-q-audio';
import { FiniteSourceAudio } from './finite-source-audio';
import {
  leonaQAudioStates,
  LEONA_Q_AUDIO_KINDS,
  type LeonaQAudioKind,
  type LeonaQAudioRecord,
} from './leona-q-state';
export class LeonaDaybreakAudio extends FiniteSourceAudio<LeonaQAudioKind, LeonaQAudioRecord> {
  constructor() {
    super(P, LEONA_Q_AUDIO_KINDS, leonaQAudioStates, 'Daybreak');
  }
  suppressAttack(id: number, start: number, attempt: number) {
    this.suppress(`${id}:${start}:attack:${attempt}`);
  }
}
