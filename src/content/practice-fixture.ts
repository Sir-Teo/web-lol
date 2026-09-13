import { LANE_END, LANE_START, MAP_HALF, SPAWN } from './map';
import { findPath, lineWalkable, reachable } from '../simulation/navigation';
import { lineOfSight } from '../simulation/vision';
import type { Battlefield } from '../simulation/battlefield';

/** Explicit deterministic regression fixture. The default application uses the full Rift. */
export const PRACTICE_FIXTURE: Battlefield = {
  id: 'practice-fixture',
  half: MAP_HALF,
  heightRange: [0, 0],
  spawns: { blue: SPAWN, red: LANE_END },
  lanes: [
    { name: 'mid', points: [LANE_START, LANE_END], spawns: { blue: LANE_START, red: LANE_END } },
  ],
  waves: { initialSeconds: 5, intervalSeconds: 30, unitIntervalSeconds: 0 },
  waveKinds: (wave) => [
    'melee',
    'melee',
    'melee',
    'caster',
    'caster',
    'caster',
    ...(wave % 3 === 0 ? ['siege' as const] : []),
  ],
  initialUnits: [
    {
      kind: 'champion',
      team: 'red',
      point: { x: 1000, y: -750 },
      name: 'Sparring partner',
      ai: true,
    },
    { kind: 'turret', team: 'blue', point: { x: -2400, y: 1800 } },
    { kind: 'turret', team: 'red', point: { x: 2400, y: -1800 } },
    { kind: 'dummy', team: 'red', point: { x: -450, y: 50 } },
  ],
  findPath,
  reachable,
  lineWalkable,
  lineOfSight,
  heightAt: () => 0,
};
