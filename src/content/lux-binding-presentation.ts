import { LUX_BINDING_FLIGHT_AUDIO } from './lux-binding-flight-audio';
import { TICK_RATE } from './rules';

/** Retain stopped flight through the source stop fade, even if its recording ends sooner. */
export const LUX_BINDING_STOP_HISTORY_TICKS = Math.ceil(
  LUX_BINDING_FLIGHT_AUDIO.fadeSeconds * TICK_RATE
);
