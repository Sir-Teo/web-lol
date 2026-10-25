import type { GarenAttackKind } from '../content/garen-attack-animation';
import type { AttackSoundMaterial } from '../content/attack-sound-material';
import type { ImpactRig } from '../content/impact-target';
import type { structurePose } from '../render/structure-pose';
import type { AnimationTimeline } from './animation-timeline';
import type { Vec2 } from './math';
import type { RiverSide } from '../content/scuttler-policy';
import type { RiftCampId } from '../content/rift-camps';
import type { MonsterSpecies, MonsterSpawnClip } from '../content/monsters';
export type Team = 'blue' | 'red';
export type ChampionIdentity = 'ashe' | 'lux' | 'garen' | 'leona' | 'ahri' | 'masteryi';
export type Faction = Team | 'neutral';
export type LaneMinionKind = 'melee' | 'caster' | 'siege' | 'super';
export const isLaneMinionKind = (kind: UnitKind): kind is LaneMinionKind =>
  kind === 'melee' || kind === 'caster' || kind === 'siege' || kind === 'super';
export type UnitKind =
  | 'champion'
  | 'melee'
  | 'caster'
  | 'siege'
  | 'super'
  | 'turret'
  | 'inhibitor'
  | 'nexus'
  | 'dummy'
  | 'monster'
  | 'ward';
export interface ScuttleMotion {
  river: RiverSide;
  destination: number;
  direction: -1 | 1;
  nextThinkTick: number;
  grazeUntil: number | null;
  fleeUntil: number | null;
  lastDamageTick: number | null;
}
export interface RiverShrine {
  river: RiverSide;
  team: Team;
  startTick: number;
  endTick: number;
}
export interface RiverScuttlers {
  initialDeaths: number;
  unitIds: Record<RiverSide, number | null>;
  pending: { side: RiverSide | 'both'; readyTick: number; deathTick: number | null } | null;
  streakSide: RiverSide | null;
  streakCount: number;
  shrines: RiverShrine[];
  speedBuffs: { unitId: number; team: Team; endTick: number }[];
}
export interface MonsterState {
  species: MonsterSpecies;
  scuttle?: ScuttleMotion;
  home: Vec2;
  phase: 'spawning' | 'idle' | 'engaged' | 'returning';
  targetId: number | null;
  spawn: { startTick: number; readyTick: number; clip: MonsterSpawnClip } | null;
}
export interface JungleSplitWave {
  parentSlot: number;
  parentId: number;
  deathTick: number;
  readyTick: number;
  point: Vec2;
  facing: number;
  targetId: number | null;
  status: 'pending' | 'spawned' | 'cancelled';
}
export interface JungleCampState {
  id: RiftCampId;
  unitIds: (number | null)[];
  cleanupTicks: (number | null)[];
  splitWaves: JungleSplitWave[];
  nextSpawnTick: number | null;
}
export type Unit = UnitBase &
  (
    | { kind: 'monster'; team: 'neutral'; monster: MonsterState }
    | { kind: Exclude<UnitKind, 'monster'>; team: Team; monster?: never }
  );
export const isStructureKind = (kind: UnitKind): boolean =>
  kind === 'turret' || kind === 'inhibitor' || kind === 'nexus';
export type TeamUnit = Extract<Unit, { team: Team }>;
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
export interface WardState {
  ownerId: number;
  createdTick: number;
  expireTick: number;
  revealUntil: number;
}
export interface WardPlacement {
  origin: Vec2;
  ownerId: number;
  team: Team;
  point: Vec2;
  startTick: number;
  readyTick: number;
  lifeTicks: number;
}
export interface OracleVisual {
  startTick: number;
  origin: Vec2;
  facing: number;
  stopTick: number | null;
  endReason: 'expired' | 'recast' | 'match-end' | null;
  childAnchor: { point: Vec2; facing: number } | null;
}
export interface TrinketState {
  kind: import('../content/trinkets').TrinketKind;
  createdTick: number;
  charges: number;
  rechargeStartTick: number | null;
  rechargeEndTick: number | null;
  rechargeDurationTicks: number | null;
  rechargeStartProgress: number;
  cooldownTick: number;
  order: Vec2 | null;
  visuals: OracleVisual[];
  scan: {
    startTick: number;
    endTick: number;
    radius: number;
    pulseStartTick: number | null;
    nextPulseTick: number;
    echoes: {
      targetId: number;
      point: Vec2;
      facing: number;
      origin: Vec2;
      createdTick: number;
      endTick: number;
    }[];
  } | null;
}
export interface UnitBase extends Vec2 {
  ward?: WardState;
  champion?: ChampionIdentity;
  id: number;
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
    leonaEclipse?: true;
    leonaQRank?: number;
    leonaQStartTick?: number;
    leonaQReleaseTick?: number;
  } | null;
  releaseTick: number | null;
  nextAttackTick: number;
  slowUntil: number;
  slowMultiplier: number;
  slows: {
    sourceId: number;
    kind:
      | 'frost'
      | 'critical-frost'
      | 'crystal-arrow'
      | 'lucent'
      | 'cinders'
      | 'smite'
      | 'scorchclaw'
      | 'solar-flare';
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
  /** Latest Charm owns forced walking until its sampled deadline. */
  charm: {
    sourceId: number;
    rank: number;
    startTick: number;
    endTick: number;
    tenacityApplied: boolean;
  } | null;
  stunUntil: number;
  rootUntil: number;
  silenceUntil: number;
  shields: {
    sourceId: number;
    amount: number;
    endTick: number;
    prismaticCastTick?: number;
    companionGrantTick?: number;
  }[];
  scorchclawBurns: {
    sourceId: number;
    startTick: number;
    endTick: number;
    nextTick: number;
    capturedMaxHp: number;
    damagePerTick: number;
  }[];
  illumination: { sourceId: number; endTick: number }[];
  sunlight: { sourceId: number; startTick: number; endTick: number } | null;
  cinderBurn: {
    sourceId: number;
    phaseTick: number;
    appliedTick: number;
    endTick: number;
    nextTick: number;
    damagePerTick: number;
  } | null;
  garenEShreds: { sourceId: number; startTick: number; endTick: number }[];
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
  team: Faction;
  origin: Vec2;
  point: Vec2;
  startTick: number;
}
export interface SingularityHit {
  targetId: number;
  targetTeam: Faction;
  targetRadius: number;
  contact: Vec2;
  audience: Team[];
  detachedTick: number | null;
  frames: (Vec2 & { tick: number })[];
}
export interface Singularity extends Vec2 {
  id: number;
  sourceId: number;
  team: Faction;
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
  hits: SingularityHit[];
}
export interface Projectile extends Vec2 {
  id: number;
  source: number;
  team: Faction;
  type:
    'attack' | 'volley' | 'ultimate' | 'hawkshot' | 'binding' | 'prismatic' | 'zenith' | 'charm';
  prismatic?: {
    phase: 'out' | 'return';
    castTick: number;
    shield: number;
    hitsOut: number[];
    hitsReturn: number[];
    returnPoint?: Vec2;
  };
  zenith?: { castTick: number; rank: number; hits: number[]; lastChampionId: number | null };
  charmRank?: number;
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
  team: Faction;
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
  team: Faction;
  launchTick: number;
  stopTick: number | null;
  frames: { tick: number; x: number; y: number; facing: number; trailDistance: number }[];
}
/** Released neutral Gromp attack path. Retained presentation never deals damage. */
export interface GrompAttackVisual {
  origin: Vec2;
  id: number;
  sourceId: number;
  team: 'neutral';
  launchTick: number;
  stopTick: number | null;
  frames: { tick: number; x: number; y: number; facing: number }[];
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
  team: Faction;
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
  | { type: 'cast'; unit: number; ability: Ability; point: Vec2; targetId?: number }
  | { type: 'learn'; unit: number; ability: 'q' | 'w' | 'e' | 'r' }
  | { type: 'ward'; unit: number; point: Vec2 }
  | { type: 'oracle'; unit: number }
  | { type: 'recall'; unit: number };
export interface SimEvent extends Vec2 {
  /** Captured Q swing identity for source/fallback coordination at release. */
  garenQStartTick?: number;
  garenAAStartTick?: number;
  leonaQStartTick?: number;
  leonaQAttackStartTick?: number;
  leonaAAStartTick?: number;
  champion?: ChampionIdentity;
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
    | 'illumination'
    | 'judgment-hit';
  unit?: number;
  value?: number;
  text?: string;
  team?: Faction;
}
export type CompanionPassive =
  | { kind: 'gustwalker'; lastBrushTick: number | null; killTick: number | null }
  | { kind: 'mosstomper'; rechargeTick: number | null }
  | { kind: 'scorchclaw'; stacks: number; nextStackTick: number };
export interface OwnedCompanion {
  acquisition: { kind: 'fixture' } | { kind: 'purchase'; consumedTick: number | null };
  passive: CompanionPassive | null;
  ownerId: number;
  kind: import('../content/companion-policy').CompanionKind;
  createdTick: number;
  x: number;
  y: number;
  previous: Vec2;
  facing: number;
  fed: number;
  bonusTreats: number;
  nextTreatTick: number | null;
  firstMonsterDone: boolean;
  firstEvolvedTick: number | null;
  fullGrownTick: number | null;
  targetId: number | null;
  activeUntil: number;
  nextStrikeTick: number;
  releaseTick: number | null;
  pose: { action: import('../content/companion-policy').CompanionAction; startTick: number };
  path: Vec2[];
  nextPathTick: number;
}
export interface ChampionState {
  role: import('../content/bot-roles').MatchRole | null;
  jungle: import('./bot-jungle').JungleBotState | null;
  summoners: import('../content/summoners').SummonerLoadout;
  smite: { charges: number; rechargeTick: number | null } | null;
  trinket: TrinketState;
  observedStats: Record<Team, { level: number; cs: number; inventory: (string | null)[] } | null>;
  revealContributors: { sourceId: number; lastRevealTick: number }[];
  assists: number;
  damageContributors: { sourceId: number; lastDamageTick: number; creditSourceId?: number }[];
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
  /** Own counter and independently committed extra melee contact. */
  doubleStrike: import('./masteryi-double-strike').DoubleStrikeState | null;
  wujuStyle: import('./masteryi-wuju-style').WujuStyleState | null;
  meditate: import('./masteryi-meditate').MeditateState | null;
  /** Accepted ordinary swings and separately confirmed contacts. Cast one-shots
   * survive cancellation; hits exist only for accepted melee contacts. */
  garenAAVisuals: {
    startTick: number;
    releaseTick: number;
    endTick: number;
    kind: GarenAttackKind;
    targetId: number;
    targetTeam: Faction;
    targetRig: string | null;
    origin: Vec2;
    castAudience: Team[];
    cancelTick: number | null;
    /** Bound swing particles stop independently of an already accepted hit/audio. */
    poseStopTick: number | null;
    poseStopReason:
      'complete' | 'order' | 'target-lost' | 'action' | 'recast' | 'death' | 'match-end' | null;
    frames: LuxImpactFrame[];
    impact: {
      tick: number;
      point: Vec2;
      material: AttackSoundMaterial;
      audience: Team[];
      facing: number;
      radius: number;
      targetTransform: readonly number[] | null;
      detachedTick: number | null;
      frames: (LuxImpactFrame & { audience: Team[] })[];
    } | null;
  }[];
  /** Actual ordinary Leona attempts; source playback must not invent canceled starts from a hit. */
  leonaAAVisuals: import('./leona-aa-visuals').LeonaAttackVisual[];
  /** Accepted death clock, fixed point and audience through both finite source layers. */
  leonaDeathVisuals: import('./leona-death-visuals').LeonaDeathVisual[];
  garenPassiveReadyTick: number;
  /** Bounded cosmetic recovery epochs; stopped sparks retain a fixed root. */
  garenPassiveVisuals: { startTick: number; stopTick: number | null; point: Vec2 | null }[];
  garenCourageStacks: number;
  /** Target-only sight persists independently of the caster's windup and life. */
  garenRReveal: { targetId: number; startTick: number; endTick: number } | null;
  /** Accepted R and its independent release/cancellation presentation history. */
  garenRVisual: {
    startTick: number;
    targetId: number;
    facing: number;
    point: Vec2;
    releaseTick: number | null;
    stopTick: number | null;
    killed: boolean;
  } | null;
  /** Shared Judgment particle/audio interval, retained through stopped sound tails. */
  garenEVisual: { startTick: number; stopTick: number | null; facing: number } | null;
  garenE: {
    startTick: number;
    endTick: number;
    rank: number;
    strikes: number;
    completedStrikes: number;
    cooldownTicks: number;
    hits: { targetId: number; count: number }[];
  } | null;
  garenW: { startTick: number; rank: number; upfrontUntil: number; defenseUntil: number } | null;
  /** Courage presentation survives the defense buff for source sound tails. */
  garenWVisual: {
    startTick: number;
    stopTick: number | null;
    endReason: 'expired' | 'death' | 'match-end' | null;
  } | null;
  /** Local reduced-hit feedback, coalesced per tick; independent of later W casts. */
  garenWDeflects: { tick: number; castTick: number }[];
  leonaR: {
    startTick: number;
    releaseTick: number;
    impactTick: number;
    released: boolean;
    rank: number;
    origin: Vec2;
    point: Vec2;
    damage: number;
  } | null;
  leonaEWindup: {
    startTick: number;
    releaseTick: number;
    rank: number;
    origin: Vec2;
    direction: Vec2;
    damage: number;
  } | null;
  leonaDash: { castTick: number; startTick: number; targetId: number } | null;
  leonaW: {
    startTick: number;
    rank: number;
    detonationTick: number;
    endTick: number;
    detonated: boolean;
  } | null;
  leonaQVisuals: import('./leona-q-visuals').DaybreakVisual[];
  leonaWVisuals: import('./leona-w-visuals').EclipseVisual[];
  leonaEVisuals: import('./leona-e-visuals').ZenithVisual[];
  leonaRVisuals: import('./leona-r-visuals').SolarFlareVisual[];
  leonaQ: { startTick: number; rank: number; endTick: number } | null;
  garenQ: {
    startTick: number;
    rank: number;
    attackUntil: number;
    speedUntil: number;
    consumed: boolean;
  } | null;
  garenQVisuals: {
    startTick: number;
    rank: number;
    stopTick: number | null;
    endReason: 'consumed' | 'expired' | 'death' | 'match-end' | 'recast' | null;
    attacks: {
      startTick: number;
      releaseTick: number;
      endTick: number;
      targetId: number;
      origin: Vec2;
      facing: number;
      stopTick: number | null;
      endReason:
        'complete' | 'target-lost' | 'death' | 'match-end' | 'recast' | 'order' | 'action' | null;
      impact: { tick: number; point: Vec2; facing: number } | null;
      landing: { tick: number; point: Vec2; facing: number } | null;
      silenceEndTick: number | null;
    }[];
  }[];
  eCharges: number;
  eRechargeTick: number | null;
  eRechargeDurationTicks: number;
  recallEnd: number | null;
  enlighten: { startTick: number; endTick: number; totalMana: number } | null;
  blueBuff: { startTick: number; endTick: number; nextRegenTick: number } | null;
  redBuff: { startTick: number; endTick: number; nextRegenTick: number } | null;
  redBuffHealReadyTick: number;
  /** Presentation can finish after the gameplay windup, until another action takes over. */
  castAnimation: { ability: 'q' | 'w' | 'e' | 'r'; startTick: number } | null;
  pendingCast: {
    targetId?: number;
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
  team: Faction;
  flight: ScoutFlight & { arrivalTick: number; distance: number };
  stopTick: number;
  endTick: number;
}
