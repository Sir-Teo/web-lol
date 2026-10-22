import blue from './blue-sentinel.json';
import red from './red-brambleback.json';
import { RIFT_GROMP_CAMPS, GROMP_FIRST_SPAWN_TICK, GROMP_RESPAWN_TICKS } from './rift-gromp-camps';
import { TICK_RATE } from './rules';

export const RIFT_CAMPS = [
  ...RIFT_GROMP_CAMPS.map((c) => ({
    ...c,
    species: 'gromp' as const,
    firstReadyTick: GROMP_FIRST_SPAWN_TICK,
    respawnTicks: GROMP_RESPAWN_TICKS,
  })),
  ...blue.camps.map((c) => ({
    ...c,
    species: 'blue' as const,
    firstReadyTick: blue.firstReadySeconds * TICK_RATE,
    respawnTicks: blue.respawnSeconds * TICK_RATE,
  })),
  ...red.camps.map((c) => ({
    ...c,
    species: 'red' as const,
    firstReadyTick: red.firstReadySeconds * TICK_RATE,
    respawnTicks: red.respawnSeconds * TICK_RATE,
  })),
];
export type RiftCampId =
  'order-gromp' | 'chaos-gromp' | 'order-blue' | 'chaos-blue' | 'order-red' | 'chaos-red';
