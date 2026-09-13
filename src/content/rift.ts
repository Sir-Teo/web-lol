import type { Battlefield, LaneRoute } from '../simulation/battlefield';
import { NavGrid } from '../simulation/navgrid';
import type { Team, UnitKind, StructureState } from '../simulation/types';
import type { Vec2 } from '../simulation/math';

interface WaveBehavior {
  SpawnCount?: number;
  SpawnCountsByWave?: number[];
  SpawnCountPerInhibitorDown?: number[];
  behaviors?: { StartTimeSecs?: number; Behavior: WaveBehavior }[];
}
export interface RiftLayout {
  half: number;
  spawns: Record<Team, Vec2>;
  lanes: LaneRoute[];
  unitStats: Battlefield['unitStats'];
  unitHealthGrowth: Battlefield['unitHealthGrowth'];
  minionTurretDamage: Battlefield['minionTurretDamage'];
  minionCurrentHealthDamage: Battlefield['minionCurrentHealthDamage'];
  siegeMidTurretAttackSpeedBonus: Battlefield['siegeMidTurretAttackSpeedBonus'];
  minionExperienceRadius: Battlefield['minionExperienceRadius'];
  turretMinionHealthDamage: Battlefield['turretMinionHealthDamage'];
  structures: (Battlefield['initialUnits'][number] & { transform: number[] })[];
  turrets: {
    point: Vec2;
    team: Team;
    tier: string;
    height: number;
    transform: number[];
    structure: StructureState;
    stats: Battlefield['initialUnits'][number]['stats'];
  }[];
  waves: Battlefield['waves'] & {
    types: { kind: UnitKind; behavior: WaveBehavior }[];
  };
}

function waveCount(behavior: WaveBehavior, wave: number, seconds: number): number {
  if (behavior.behaviors) {
    const active = behavior.behaviors.filter((item) => (item.StartTimeSecs ?? 0) <= seconds).at(-1);
    return active ? waveCount(active.Behavior, wave, seconds) : 0;
  }
  if (behavior.SpawnCountsByWave)
    return behavior.SpawnCountsByWave[(wave - 1) % behavior.SpawnCountsByWave.length];
  return behavior.SpawnCount ?? 0;
}

export function createRift(grid: NavGrid, layout: RiftLayout): Battlefield {
  const mid = layout.lanes.find((lane) => lane.name === 'mid')!;
  const spawns = {
    blue: grid.reachable(layout.spawns.blue, 35, 'blue'),
    red: grid.reachable(layout.spawns.red, 35, 'red'),
  };
  return {
    id: 'rift',
    visibilityRevision: 0,
    half: layout.half,
    heightRange: grid.heightRange,
    spawns,
    lanes: layout.lanes,
    waves: layout.waves,
    unitStats: layout.unitStats,
    unitHealthGrowth: layout.unitHealthGrowth,
    minionTurretDamage: layout.minionTurretDamage,
    minionCurrentHealthDamage: layout.minionCurrentHealthDamage,
    siegeMidTurretAttackSpeedBonus: layout.siegeMidTurretAttackSpeedBonus,
    minionExperienceRadius: layout.minionExperienceRadius,
    turretMinionHealthDamage: layout.turretMinionHealthDamage,
    waveKinds: (wave, seconds, context) => {
      const superSpec = layout.waves.types.find((type) => type.kind === 'super');
      const supers = context?.enemyLaneInhibitorDown
        ? (superSpec?.behavior.SpawnCountPerInhibitorDown?.[context.enemyInhibitorsDown - 1] ?? 0)
        : 0;
      return ['melee', 'super', 'siege', 'caster'].flatMap((kind) => {
        if (kind === 'super') return Array.from({ length: supers }, () => 'super' as const);
        if (kind === 'siege' && supers) return [];
        const spec = layout.waves.types.find((type) => type.kind === kind)!;
        return Array.from({ length: waveCount(spec.behavior, wave, seconds) }, () => spec.kind);
      });
    },
    initialUnits: [
      ...layout.turrets.map((tower) => ({
        kind: 'turret' as const,
        team: tower.team,
        point: tower.point,
        name: `${tower.tier} turret`,
        structureTransform: tower.transform,
        structure: tower.structure,
        stats: tower.stats,
      })),
      ...layout.structures.map((building) => ({
        ...building,
        name: building.kind === 'nexus' ? 'Nexus' : 'Inhibitor',
        structureTransform: building.transform,
      })),
      {
        kind: 'champion',
        team: 'red',
        point: grid.reachable(mid.points[9], 35, 'red'),
        name: 'Sparring partner',
        ai: true,
      },
      {
        kind: 'dummy',
        team: 'red',
        point: grid.reachable({ x: spawns.blue.x + 620, y: spawns.blue.y - 480 }, 40, 'red'),
      },
    ],
    reachable: grid.reachable.bind(grid),
    findPath: grid.findPath.bind(grid),
    lineWalkable: grid.lineWalkable.bind(grid),
    lineOfSight: grid.lineOfSight.bind(grid),
    heightAt: grid.heightAt.bind(grid),
  };
}

export async function loadRiftBattlefield(): Promise<Battlefield> {
  const responses = await Promise.all(
    ['rift-nav.json', 'rift-nav.bin', 'rift-layout.json'].map((name) =>
      fetch(`/assets/maps/${name}`)
    )
  );
  if (responses.some((response) => !response.ok))
    throw new Error('Rift gameplay data could not be loaded');
  const metadata = await responses[0].json(),
    bytes = await responses[1].arrayBuffer(),
    layout = (await responses[2].json()) as RiftLayout;
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (digest !== metadata.output.sha256)
    throw new Error('Rift navigation failed its integrity check');
  return createRift(new NavGrid(metadata, bytes), layout);
}
