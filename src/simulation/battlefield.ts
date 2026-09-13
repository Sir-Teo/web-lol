import type { Vec2 } from './math';
import type { Team, UnitKind } from './types';

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
  id: 'practice-fixture' | 'rift';
  half: number;
  heightRange: readonly [number, number];
  spawns: Record<Team, Vec2>;
  lanes: LaneRoute[];
  waves: { initialSeconds: number; intervalSeconds: number; unitIntervalSeconds: number };
  waveKinds(wave: number, seconds: number): UnitKind[];
  initialUnits: {
    kind: UnitKind;
    team: Team;
    point: Vec2;
    name?: string;
    ai?: boolean;
    structureTransform?: readonly number[];
  }[];
}
