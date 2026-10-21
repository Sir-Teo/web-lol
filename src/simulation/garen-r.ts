import { GAREN_R } from '../content/garen-r';

export function garenRDamage(rank: number, hp: number, maxHp: number): number {
  return (
    GAREN_R.baseDamageByRank[rank - 1] +
    GAREN_R.missingHealthRatioByRank[rank - 1] * Math.max(0, maxHp - hp)
  );
}

/** Shared particle/audio history; particles still expire on their source lives. */
export { GAREN_R_AUDIO_TAIL_TICKS as GAREN_R_PRESENTATION_TAIL_TICKS } from '../content/garen-r-audio-timing';
