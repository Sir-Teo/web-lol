import blue from './blue-sentinel.json';
import red from './red-brambleback.json';
import wolves from './wolf-camps.json';
import raptors from './raptor-camps.json';
import { MONSTERS, type MonsterSpecies, type MonsterSpawnClip } from './monsters';
import { RIFT_GROMP_CAMPS, GROMP_FIRST_SPAWN_TICK, GROMP_RESPAWN_TICKS } from './rift-gromp-camps';
import { TICK_RATE } from './rules';
import type { Battlefield } from '../simulation/battlefield';

const SINGLE_CAMPS = [
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
export const RIFT_CAMPS = [
  ...SINGLE_CAMPS.map((c) => ({
    ...c,
    members: [
      {
        species: c.species as MonsterSpecies,
        point: c.point,
        spawnClip: 'spawn' as MonsterSpawnClip,
      },
    ],
    cleanupDelayTicks: null as number | null,
    leadupTicks: null as number | null,
    projectHomes: false,
  })),
  ...wolves.camps.map((c) => ({
    ...c,
    species: 'wolf' as MonsterSpecies,
    point: c.members[0].point,
    members: c.members.map((m) => ({
      ...m,
      species: m.species as MonsterSpecies,
      spawnClip: m.spawnClip as MonsterSpawnClip,
    })),
    firstReadyTick: wolves.firstReadySeconds * TICK_RATE,
    respawnTicks: wolves.respawnSeconds * TICK_RATE,
    cleanupDelayTicks: wolves.cleanupSeconds * TICK_RATE,
    leadupTicks: null as number | null,
    projectHomes: false,
  })),
  ...raptors.camps.map((c) => ({
    ...c,
    species: 'raptor' as MonsterSpecies,
    point: c.members[0].point,
    members: c.members.map((m) => ({
      ...m,
      species: m.species as MonsterSpecies,
      spawnClip: m.spawnClip as MonsterSpawnClip,
    })),
    firstReadyTick: raptors.firstReadySeconds * TICK_RATE,
    respawnTicks: raptors.respawnSeconds * TICK_RATE,
    cleanupDelayTicks: raptors.cleanupSeconds * TICK_RATE,
    leadupTicks: Math.round(c.leadupSeconds * TICK_RATE),
    projectHomes: true,
  })),
];
export type RiftCampId =
  | 'order-gromp'
  | 'chaos-gromp'
  | 'order-blue'
  | 'chaos-blue'
  | 'order-red'
  | 'chaos-red'
  | 'order-wolves'
  | 'chaos-wolves'
  | 'order-raptors'
  | 'chaos-raptors';
export function campLeadupTicks(camp: (typeof RIFT_CAMPS)[number]): number {
  return (
    camp.leadupTicks ?? Math.max(...camp.members.map((m) => MONSTERS[m.species].spawnLeadupTicks))
  );
}
/** Local placement adapter: retain raw locators in content, but keep raptor homes
 * reachable when a legacy locator intersects the imported navigation grid. */
export function campMemberHome(
  camp: (typeof RIFT_CAMPS)[number],
  slot: number,
  battlefield: Battlefield
) {
  const member = camp.members[slot];
  return camp.projectHomes
    ? battlefield.reachable(member.point, MONSTERS[member.species].pathfindingRadius, 'blue')
    : member.point;
}
