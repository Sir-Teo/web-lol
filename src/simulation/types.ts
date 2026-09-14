import type { ImpactRig } from '../content/impact-target';
import type { structurePose } from '../render/structure-pose';
import type { AnimationTimeline } from './animation-timeline';
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
  champion?: 'ashe' | 'lux' | 'garen';
  id: number;
  kind: UnitKind;
  team: Team;
  name: string;
  previous: Vec2;
  facing: number;
  animationTimeline: AnimationTimeline | null;
  /** Fixed-step run-clip seconds within the current movement segment. */
  runClock: { startTick: number; previous: number; current: number } | null;
  idleClock: { startTick: number; previous: number; current: number } | null;
  /** Authored source matrix for fixed structures; independent of attack facing. */
  structureTransform?: readonly number[];
  structure?: StructureState;
  /** Public initial placement; null means known intact, otherwise the known destruction tick. */
  structureKnowledge?: Record<Team, number | null>;
  /** Actual idle entry and each team's observed entry; regrowth can remain hidden. */
  structureIdle?: { startTick: number; observedStartTicks: Record<Team, number> };
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
  attackCycle: {
    startTick: number;
    endTick: number;
    empowered: boolean;
    critical?: true;
    garenQRank?: number;
    garenQReleaseTick?: number;
  } | null;
  releaseTick: number | null;
  nextAttackTick: number;
  slowUntil: number;
  slowMultiplier: number;
  slows: {
    sourceId: number;
    kind: 'frost' | 'critical-frost' | 'crystal-arrow' | 'lucent';
    startTick: number;
    endTick: number;
    startMultiplier: number;
    endMultiplier: number;
  }[];
  criticalSlow: {
    startTick: number;
    endTick: number;
    startMultiplier: number;
    endMultiplier: number;
  } | null;
  stunUntil: number;
  rootUntil: number;
  silenceUntil: number;
  shields: { sourceId: number; amount: number; endTick: number; prismaticCastTick?: number }[];
  illumination: { sourceId: number; endTick: number }[];
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
export interface LuxBeam {
  id: number;
  sourceId: number;
  team: Team;
  origin: Vec2;
  point: Vec2;
  startTick: number;
}
export interface Singularity extends Vec2 {
  id: number;
  sourceId: number;
  team: Team;
  origin: Vec2;
  previous: Vec2;
  point: Vec2;
  launchTick: number;
  arrivalTick: number | null;
  endTick: number | null;
  detonatedTick: number | null;
  detonateRequested: boolean;
  damage: number;
  slowMultiplier: number;
}
export interface Projectile extends Vec2 {
  id: number;
  source: number;
  team: Team;
  type: 'attack' | 'volley' | 'ultimate' | 'hawkshot' | 'binding' | 'prismatic';
  prismatic?: {
    phase: 'out' | 'return';
    castTick: number;
    shield: number;
    hitsOut: number[];
    hitsReturn: number[];
    returnPoint?: Vec2;
  };
  bindingHits?: number[];
  bindingAudioVariant?: 0 | 1;
  previous: Vec2;
  direction: Vec2;
  target: number | null;
  damage: number;
  speed: number;
  radius: number;
  remaining: number;
  volleyId: number | null;
  /** Captured Q identity; never inferred from the source's current buff. */
  empowered?: boolean;
  /** Windup roll retained through travel and delayed flurry shots. */
  critical?: true;
  flurryShot?: number;
  /** Required for Hawkshot's per-cast source animation phase. */
  launchTick?: number;
  origin?: Vec2;
}
/** Stopped Light Binding flight retained for presentation; ID belongs to its removed projectile. */
export interface BindingFlightStop {
  id: number;
  sourceId: number;
  team: Team;
  origin: Vec2;
  point: Vec2;
  launchTick: number;
  stopTick: number;
  reason: 'hit-limit' | 'range';
  variant: 0 | 1;
}
/** A released Lux basic attack's presentation path, retained briefly after removal.
 * IDs are the originating projectile ID; this record is not a gameplay entity.
 */
export interface LuxAttackVisual {
  origin: Vec2;
  id: number;
  sourceId: number;
  team: Team;
  launchTick: number;
  stopTick: number | null;
  frames: { tick: number; x: number; y: number; facing: number; trailDistance: number }[];
}
export interface LuxImpactFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  /** Independent end-of-tick mobile pose; frozen with placement after detachment. */
  animationTimeline: AnimationTimeline | null;
  structurePose: ReturnType<typeof structurePose> | null;
}
/** Confirmed Lux basic-attack hit; target placement and source pose history.
 * The originating projectile ID is shared with its retained flight history.
 */
export interface LuxImpactVisual {
  id: number;
  sourceId: number;
  targetId: number;
  team: Team;
  startTick: number;
  critical: boolean;
  detachedTick: number | null;
  targetRig: ImpactRig | null;
  targetTransform: readonly number[] | null;
  frames: LuxImpactFrame[];
}
/** Saved passive detonation, sharing the historical target pose representation. */
export interface LuxIlluminationVisual extends LuxImpactVisual {
  audience: Team[];
}
export type Ability = 'q' | 'w' | 'e' | 'r' | 'd' | 'f';
export type Command =
  | { type: 'order'; unit: number; order: Order }
  | { type: 'cast'; unit: number; ability: Ability; point: Vec2 }
  | { type: 'learn'; unit: number; ability: 'q' | 'w' | 'e' | 'r' }
  | { type: 'recall'; unit: number };
export interface SimEvent extends Vec2 {
  champion?: 'ashe' | 'lux' | 'garen';
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
    | 'scout-arrival'
    | 'illumination';
  unit?: number;
  value?: number;
  text?: string;
  team?: Team;
}
export interface ChampionState {
  observedStats: Record<Team, { level: number; cs: number; inventory: (string | null)[] } | null>;
  revealContributors: { sourceId: number; lastRevealTick: number }[];
  assists: number;
  damageContributors: { sourceId: number; lastDamageTick: number }[];
  /** Allied Heal casters; support attribution is resolved when a victim dies. */
  supportContributors: { sourceId: number; lastSupportTick: number }[];
  id: number;
  gold: number;
  cs: number;
  kills: number;
  deaths: number;
  xp: number;
  level: number;
  skillPoints: number;
  spellRanks: Record<'q' | 'w' | 'e' | 'r', number>;
  cooldowns: Record<Ability, number>;
  qStacks: number;
  qUntil: number;
  qStackExpiry: number;
  garenPassiveReadyTick: number;
  garenW: { startTick: number; rank: number; upfrontUntil: number; defenseUntil: number } | null;
  garenQ: {
    startTick: number;
    rank: number;
    attackUntil: number;
    speedUntil: number;
    consumed: boolean;
  } | null;
  eCharges: number;
  eRechargeTick: number | null;
  eRechargeDurationTicks: number;
  recallEnd: number | null;
  enlighten: { startTick: number; endTick: number; totalMana: number } | null;
  /** Presentation can finish after the gameplay windup, until another action takes over. */
  castAnimation: { ability: 'q' | 'w' | 'e' | 'r'; startTick: number } | null;
  pendingCast: {
    detonateRequested?: boolean;
    shield?: number;
    origin?: Vec2;
    ability: 'q' | 'w' | 'e' | 'r';
    rank: number;
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
