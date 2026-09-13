import type { Vec2 } from './math';
export type Team = 'blue' | 'red';
export type UnitKind = 'champion' | 'melee' | 'caster' | 'siege' | 'turret' | 'dummy';
export type Order =
  | { type: 'idle' }
  | { type: 'move' | 'attackMove'; point: Vec2 }
  | { type: 'attack'; target: number };
export interface Unit extends Vec2 {
  id: number;
  kind: UnitKind;
  team: Team;
  name: string;
  previous: Vec2;
  facing: number;
  radius: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  damage: number;
  armor: number;
  range: number;
  speed: number;
  attackPeriod: number;
  windupTicks: number;
  missileSpeed: number;
  order: Order;
  path: Vec2[];
  pathTarget: Vec2 | null;
  attackTarget: number | null;
  releaseTick: number | null;
  nextAttackTick: number;
  slowUntil: number;
  stunUntil: number;
  deadAt: number | null;
  ai: boolean;
  nextThink: number;
  respawnTick: number | null;
}
export interface Projectile extends Vec2 {
  id: number;
  source: number;
  team: Team;
  type: 'attack' | 'volley' | 'ultimate';
  previous: Vec2;
  direction: Vec2;
  target: number | null;
  damage: number;
  speed: number;
  radius: number;
  remaining: number;
  volleyId: number | null;
}
export type Ability = 'q' | 'w' | 'e' | 'r' | 'd' | 'f';
export type Command =
  | { type: 'order'; unit: number; order: Order }
  | { type: 'cast'; unit: number; ability: Ability; point: Vec2 }
  | { type: 'recall'; unit: number };
export interface SimEvent extends Vec2 {
  /** Fixed when emitted: later vision must never expose an earlier hidden event. */
  audience: Team[];
  id: number;
  tick: number;
  type: 'damage' | 'gold' | 'attack' | 'cast' | 'death' | 'move' | 'level' | 'heal' | 'message';
  unit?: number;
  value?: number;
  text?: string;
  team?: Team;
}
export interface PlayerState {
  id: number;
  gold: number;
  cs: number;
  kills: number;
  deaths: number;
  xp: number;
  level: number;
  cooldowns: Record<Ability, number>;
  qStacks: number;
  qUntil: number;
  qStackExpiry: number;
  recallEnd: number | null;
  inventory: string[];
}
