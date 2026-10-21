import { GAREN_R } from './garen-r';
import { TICK_RATE } from './rules';

// Adapter policies, separate from the generated source record. Native timing
// precedence and playback rates remain unverified.
export const GAREN_R_WINDUP_TICKS = Math.ceil(GAREN_R.authoredCastSeconds * TICK_RATE);
export const GAREN_R_REVEAL_TICKS = Math.round(GAREN_R.revealSeconds * TICK_RATE);
export const GAREN_R_ANIMATION_CONTACT = GAREN_R.animationCastFrame / GAREN_R.animationFps;
