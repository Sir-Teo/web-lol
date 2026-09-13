import type { Vec2 } from '../simulation/math';

export interface Obstacle extends Vec2 { radius: number; height: number }
export const MAP_HALF = 4100;
export const LANE_START: Vec2 = { x: -3300, y: 2475 };
export const LANE_END: Vec2 = { x: 3300, y: -2475 };
export const SPAWN: Vec2 = { x: -1100, y: 825 };
/** Authored practice terrain. Full measured Summoner's Rift geometry remains separate work. */
export const OBSTACLES: Obstacle[] = [
  { x: -1300, y: -650, radius: 380, height: 260 },
  { x: -2050, y: -300, radius: 320, height: 300 },
  { x: -2550, y: 200, radius: 290, height: 270 },
  { x: 1200, y: 650, radius: 380, height: 280 },
  { x: 2100, y: 300, radius: 320, height: 320 },
  { x: 2600, y: -180, radius: 290, height: 230 },
  { x: -650, y: -1850, radius: 310, height: 290 },
  { x: 620, y: 1850, radius: 320, height: 280 },
];
export const BRUSH = [
  { x: -820, y: -50, radius: 240 },
  { x: 900, y: 0, radius: 240 },
];
