import profile from './rift-gromp-camps.json';
import { TICK_RATE } from './rules';

export const RIFT_GROMP_CAMPS = profile.camps;
export type RiftGrompCampId = 'order-gromp' | 'chaos-gromp';
export const GROMP_FIRST_SPAWN_TICK = profile.firstSpawnSeconds * TICK_RATE;
/** Provisional policy, retained separately from legacy first-spawn evidence. */
export const GROMP_RESPAWN_TICKS = profile.respawnSeconds * TICK_RATE;
