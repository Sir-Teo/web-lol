import type { Vec2 } from './math';
export type Team = 'blue' | 'red';
export type LaneMinionKind = 'melee' | 'caster' | 'siege' | 'super';
export const isLaneMinionKind = (kind: UnitKind): kind is LaneMinionKind =>
  kind === 'melee' || kind === 'caster' || kind === 'siege' || kind === 'super';
export type UnitKind =
  'champion' | 'melee' | 'caster' | 'siege' | 'super' | 'turret' | 'inhibitor' | 'nexus' | 'dummy';
export const isStructureKind = (kind: UnitKind): boolean =>
  kind === 'turret' || kind === 'inhibitor' || kind === 'nexus';
export interface StructureState {
  role:
    'outer-turret' | 'inner-turret' | 'inhibitor-turret' | 'nexus-turret' | 'inhibitor' | 'nexus';
  lane: 'top' | 'mid' | 'bot' | null;
  healthBarHeight: number;
  regenPerSecond: number;
}
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
  /** Authored source matrix for fixed structures; independent of attack facing. */
  structureTransform?: readonly number[];
  structure?: StructureState;
  /** Public initial placement, then last known intact/destroyed state per team. */
  structureKnowledge?: Record<Team, boolean>;
  radius: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  damage: number;
  armor: number;
  magicResist: number;
  range: number;
  speed: number;
  attackPeriod: number;
  windupTicks: number;
  missileSpeed: number;
  goldBounty?: number;
  experienceBounty?: number;
  /** Simulation retention floor for complete source death-animation playback. */
  corpseLifetimeTicks?: number;
  order: Order;
  path: Vec2[];
  pathTarget: Vec2 | null;
  pathDestination: Vec2 | null;
  nextPathTick: number;
  lane: number | null;
  laneWaypoint: number;
  attackTarget: number | null;
  /** Empowerment is captured at attack start for source animation selection. */
  attackCycle: { startTick: number; endTick: number; empowered: boolean } | null;
  releaseTick: number | null;
  nextAttackTick: number;
  slowUntil: number;
  slowMultiplier: number;
  criticalSlow: {
    startTick: number;
    endTick: number;
    startMultiplier: number;
    endMultiplier: number;
  } | null;
  stunUntil: number;
  summonerHealReductionUntil: number;
  summonerHealSpeedUntil: number;
  deadAt: number | null;
  ai: boolean;
  aiRetreating: boolean;
  nextThink: number;
  respawnTick: number | null;
}
export type UnitStats = Partial<
  Pick<
    Unit,
    | 'maxHp'
    | 'damage'
    | 'armor'
    | 'magicResist'
    | 'range'
    | 'radius'
    | 'attackPeriod'
    | 'speed'
    | 'windupTicks'
    | 'missileSpeed'
    | 'goldBounty'
    | 'experienceBounty'
    | 'corpseLifetimeTicks'
  >
>;
export interface Projectile extends Vec2 {
  id: number;
  source: number;
  team: Team;
  type: 'attack' | 'volley' | 'ultimate' | 'hawkshot';
  previous: Vec2;
  direction: Vec2;
  target: number | null;
  damage: number;
  speed: number;
  radius: number;
  remaining: number;
  volleyId: number | null;
  /** Required for Hawkshot's per-cast source animation phase. */
  launchTick?: number;
  origin?: Vec2;
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
  type:
    | 'damage'
    | 'gold'
    | 'attack'
    | 'cast'
    | 'death'
    | 'move'
    | 'level'
    | 'heal'
    | 'message'
    | 'scout-arrival';
  unit?: number;
  value?: number;
  text?: string;
  team?: Team;
}
export interface ChampionState {
  revealContributors: { sourceId: number; lastRevealTick: number }[];
  assists: number;
  damageContributors: { sourceId: number; lastDamageTick: number }[];
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
  eCharges: number;
  eRechargeTick: number | null;
  recallEnd: number | null;
  /** Presentation can finish after the gameplay windup, until another action takes over. */
  castAnimation: { ability: 'w' | 'e' | 'r'; startTick: number } | null;
  pendingCast: {
    ability: 'w' | 'e' | 'r';
    startTick: number;
    releaseTick: number;
    point: Vec2;
    damage: number;
  } | null;
  inventory: (string | null)[];
}

/** Human HUD/input view of its champion-owned state. */
export type PlayerState = ChampionState;

/** Source trajectory retained for deterministic particle tails after arrival. */
export interface ScoutFlight {
  id: number;
  origin: Vec2;
  direction: Vec2;
  speed: number;
  launchTick: number;
  arrivalTick?: number;
  distance?: number;
}

/** Presentation-only arrival state; never a vision or targeting source. */
export interface ScoutVisual extends Vec2 {
  team: Team;
  flight: ScoutFlight & { arrivalTick: number; distance: number };
  stopTick: number;
  endTick: number;
}
