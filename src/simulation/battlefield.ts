import type { Vec2 } from './math';
import type { Team, UnitKind, UnitStats, StructureState, LaneMinionKind } from './types';

export interface WaveContext {
  enemyLaneInhibitorDown: boolean;
  enemyInhibitorsDown: number;
}

export interface TerrainQueries {
  reachable(point: Vec2, radius: number, team?: Team): Vec2;
  findPath(from: Vec2, to: Vec2, radius: number, team?: Team): Vec2[];
  lineWalkable(from: Vec2, to: Vec2, radius: number, team?: Team): boolean;
  lineOfSight(from: Vec2, to: Vec2): boolean;
  heightAt(point: Vec2): number;
}

export interface LaneRoute {
  name: string;
  points: Vec2[];
  spawns: Record<Team, Vec2>;
}

export interface Battlefield extends TerrainQueries {
  /** Advance whenever sight geometry changes; omit to disable presentation ray caching. */
  visibilityRevision?: number;
  id: 'practice-fixture' | 'rift';
  half: number;
  heightRange: readonly [number, number];
  spawns: Record<Team, Vec2>;
  lanes: LaneRoute[];
  waves: {
    initialSeconds: number;
    intervalSeconds: number;
    unitIntervalSeconds: number;
    intervalChanges?: { startSeconds: number; intervalSeconds: number }[];
    moveSpeed?: {
      startSeconds: number;
      intervalSeconds: number;
      increment: number;
      maxUpgrades: number;
    };
  };
  waveKinds(wave: number, seconds: number, context?: WaveContext): UnitKind[];
  unitHealthGrowth?: Partial<
    Record<
      LaneMinionKind,
      Record<
        Team,
        {
          intervalSeconds: number;
          increment: number;
          maxBonus: number;
        }
      >
    >
  >;
  minionTurretDamage?: Record<LaneMinionKind, number>;
  minionCurrentHealthDamage?: Partial<Record<LaneMinionKind, Record<Team, number>>>;
  siegeMidTurretAttackSpeedBonus?: number;
  unitStats?: Partial<Record<UnitKind, Record<Team, UnitStats>>>;
  initialUnits: {
    kind: UnitKind;
    team: Team;
    point: Vec2;
    name?: string;
    ai?: boolean;
    structureTransform?: readonly number[];
    structure?: StructureState;
    stats?: UnitStats;
  }[];
}
