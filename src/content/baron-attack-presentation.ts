import source from './baron.json';
import { TICK_RATE } from './rules';

// Conservative local source-visible bounds, including two interpolation intervals.
// Native particle stop/linger dispatch remains an independent acceptance gate.
export const BARON_ATTACK_FLIGHT_TAIL_TICKS = 87;
export const BARON_ATTACK_HIT_HISTORY_TICKS = 125;
// The composed emitter RNG and surface odometer depend on the full launch prefix.
// Bound all 4,000 source units of flight plus the longer retained presentation tail.
export const BARON_ATTACK_MAX_FLIGHT_TICKS = Math.ceil(
  (4000 / source.basicAttack.missileSpeed) * TICK_RATE
);
export const BARON_ATTACK_PATH_FRAMES =
  BARON_ATTACK_MAX_FLIGHT_TICKS +
  Math.max(BARON_ATTACK_FLIGHT_TAIL_TICKS, BARON_ATTACK_HIT_HISTORY_TICKS) +
  2;
