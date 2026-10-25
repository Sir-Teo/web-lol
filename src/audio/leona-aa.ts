import { FiniteSourceAudio } from './finite-source-audio';
import {
  LEONA_AA_AUDIO_PROFILE,
  LEONA_AA_AUDIO_KINDS,
  leonaAAAudioStates,
  type LeonaAAAudioKind,
  type LeonaAAAudioRecord,
} from './leona-aa-state';
export class LeonaBasicAttackAudio extends FiniteSourceAudio<LeonaAAAudioKind, LeonaAAAudioRecord> {
  constructor() {
    super(LEONA_AA_AUDIO_PROFILE, LEONA_AA_AUDIO_KINDS, leonaAAAudioStates, 'Leona basic attack');
  }
  suppressSwing(id: number, start: number) {
    for (const kind of LEONA_AA_AUDIO_KINDS) this.suppress(`${id}:${start}:${kind}`);
  }
}
