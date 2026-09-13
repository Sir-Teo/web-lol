import { HAWKSHOT_LINGER_AUDIO } from './hawkshot-linger-audio';

/** Maximum active particle lifetime among the sustained emitters in the pinned linger record.
 * Aurora is single-birth and expires before the scouting stop time. See docs/ASHE-E.md.
 */
export const HAWKSHOT_LINGER_TAIL_SECONDS = 1;

/** Saved presentation includes the persistent sound's authored stop transition. */
export const HAWKSHOT_PRESENTATION_TAIL_SECONDS = Math.max(
  HAWKSHOT_LINGER_TAIL_SECONDS,
  HAWKSHOT_LINGER_AUDIO.fadeSeconds
);
