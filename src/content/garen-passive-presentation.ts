import { GAREN_P_ONSET_TICKS } from './garen-p-audio-timing';
import profile from './garen-passive-particles.json';
/** Maximum source life, plus first-update and interpolation coverage at 60 Hz. */
export const GAREN_PASSIVE_TAIL_TICKS = Math.ceil(profile.maxLife * 60) + 2;

/** Maximum stopped-history bound, including an immediately stopped onset cue. */
export const GAREN_PASSIVE_HISTORY_TICKS = Math.max(GAREN_PASSIVE_TAIL_TICKS, GAREN_P_ONSET_TICKS);
