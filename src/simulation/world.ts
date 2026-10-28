import { advancePrimaryHitPoses } from './masteryi-primary-hit-poses';
import {
  capturePassiveTrail,
  advancePassiveTrails,
  resolvePassiveTrailMarkers,
} from './masteryi-passive-trails';
import { advancePrimaryTrailRoots } from './masteryi-primary-trails';
import { captureSwordGlow, advanceSwordGlows, swordGlowExpiry } from './masteryi-sword-glow';
import { captureMeditateDamage, advanceMeditateDamage } from './masteryi-meditate-damage';
import { MEDITATE_DAMAGE_HISTORY_TICKS } from '../content/masteryi-w-damage-timing';
import { advanceHighlanderKills } from './masteryi-highlander-kill';
import { HIGHLANDER_KILL_HISTORY_TICKS } from '../content/masteryi-r-kill-timing';
import { captureHighlanderCast, advanceHighlanderCasts } from './masteryi-highlander-cast';
import { HIGHLANDER_CAST_HISTORY_TICKS } from '../content/masteryi-r-cast-timing';
import { advanceAlphaEnds } from './masteryi-q-end';
import { ALPHA_END_HISTORY_TICKS } from '../content/masteryi-q-end-timing';
import { captureAlphaCast, advanceAlphaCasts } from './masteryi-q-cast';
import { ALPHA_CAST_HISTORY_TICKS } from '../content/masteryi-q-cast-timing';
import {
  beginWujuStyleAudio,
  stopWujuStyleAudio,
  wujuStyleAudioExpiry,
} from './masteryi-wuju-style-audio';
import {
  beginMeditateAudio,
  stopMeditateAudio,
  meditateAudioExpiry,
} from './masteryi-meditate-audio';
import {
  captureMeditateBuff,
  stopMeditateBuff,
  advanceMeditateBuffs,
  meditateBuffExpiry,
} from './masteryi-meditate-buff';
import { captureMeditateCast, advanceMeditateCasts } from './masteryi-meditate-cast';
import { MEDITATE_CAST_HISTORY_TICKS } from '../content/masteryi-w-cast-timing';
import { captureAlphaContact, advanceAlphaContacts } from './masteryi-q-contact-visuals';
import { beginAlphaAudio, contactAlphaAudio, alphaAudioExpiry } from './masteryi-q-audio';
import { ALPHA_CONTACT_HISTORY_TICKS } from '../content/masteryi-q-contact-timing';
import type { AlphaStrikeMark } from './masteryi-alpha-strike';
import {
  beginHighlanderAudio,
  stopHighlanderAudio,
  highlanderAudioExpiry,
} from './masteryi-highlander-audio';
import {
  beginMasterYiAttack,
  contactMasterYiAttack,
  cancelMasterYiAttack,
  masterYiAttackExpiry,
} from './masteryi-aa-presentation';
import { captureLeonaDeath, advanceLeonaDeaths } from './leona-death-visuals';
import { AHRI_Q } from '../content/ahri-q';
import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { ahriOrbDamage, beginAhriOrb, advanceAhriOrbs, type AhriOrb } from './ahri-orbs';
import {
  onEssenceDeath,
  advanceEssences,
  stopEssences,
  type EssenceCounter,
  type AhriEssence,
} from './ahri-essences';
import { AHRI_R } from '../content/ahri-r';
import {
  activeSpiritRush,
  activeSpiritDash,
  beginSpiritRush,
  advanceSpiritDash,
  advanceSpiritBolts,
  expireSpiritRushes,
  stopSpiritDash,
  stopSpiritRush,
  spiritRushDestination,
  spiritRushDamage,
  type SpiritRush,
} from './ahri-spirit-rush';
import { AHRI_E } from '../content/ahri-e';
import { AHRI_E_POLICY } from '../content/ahri-e-policy';
import { AHRI_W } from '../content/ahri-w';
import { AHRI_W_POLICY } from '../content/ahri-w-policy';
import {
  beginFoxFireCast,
  releaseFoxFireCast,
  advanceFoxFires,
  foxFireDamage,
  foxFireMovementBonus,
  stopFoxFireOrbits,
  type FoxFireCast,
} from './ahri-fox-fires';
import {
  advanceZenithVisuals,
  beginZenithVisual,
  launchZenithVisual,
  captureZenithFlightFrame,
  contactZenithVisual,
  finishZenithFlight,
  settleZenithFlight,
  beginZenithDashVisual,
  stopZenithDashVisual,
  stopZenithVisual,
  type ZenithDashEnd,
} from './leona-e-visuals';
import {
  advanceSolarVisuals,
  beginSolarVisual,
  releaseSolarVisual,
  finishSolarVisual,
  impactSolarVisual,
} from './leona-r-visuals';
import {
  advanceEclipseVisuals,
  beginEclipseVisual,
  captureEclipseDetonation,
  finishEclipseVisual,
} from './leona-w-visuals';
import {
  advanceDaybreakVisuals,
  beginDaybreakVisual,
  captureDaybreakAttack,
  contactDaybreakVisual,
  finishDaybreakVisual,
} from './leona-q-visuals';
import {
  beginLeonaAttack,
  contactLeonaAttack,
  finishLeonaAttack,
  advanceLeonaAttacks,
} from './leona-aa-visuals';
import {
  advanceSunlightVisuals,
  captureSunlightVisual,
  type SunlightVisual,
} from './sunlight-visuals';
import {
  beginGarenAttack,
  contactGarenAttack,
  cancelGarenAttack,
  garenAttackExpiry,
  advanceGarenAttackPoses,
} from './garen-aa-presentation';
import { capturePoseFrame } from './pose-history';
import { advancePerseveranceVisual, stopPerseveranceVisual } from './garen-passive-visuals';
import { advanceLuxEHits, recordLuxEHit } from './lux-e-hits';
import { advanceLuxEAudio, newLuxEAudioHistory } from './lux-e-audio';
import { BOT_TEAM_POLICY } from '../content/bot-team-policy';
import {
  planTeam,
  type TeamPlan,
  type TeamGoal,
  type TeamObservation,
  type SeenStructure,
} from './bot-team';
import { jungleDecision, jungleRoute } from './bot-jungle';
import { JUNGLE_BOT_POLICY } from '../content/bot-roles';
import { advanceWards, requestWard, hitWard } from './wards';
import { requestOracle, advanceOracles, wardDetected, wardDisabled } from './oracle-lens';
import { finishOracleVisual, advanceOracleVisuals } from './oracle-presentation';
import { WARD_SOURCE, WARD_POLICY } from '../content/warding-totem';
import type { WardPlacement } from './types';
import {
  advanceRiverScuttlers,
  advanceScuttler,
  grantRiverSpeed,
  newRiverScuttlers,
  scuttlerKilled,
  shrinePoint,
} from './scuttler';
import { SUMMONER_SMITE } from '../content/summoner-smite';
import {
  SUMMONERS,
  isSummonerSlot,
  type SummonerSpell,
  type SummonerSlot,
} from '../content/summoners';
import { smiteTarget } from './smite';
import { companionItemKind, isDoranStarter } from '../content/companion-items-policy';
import {
  companionMovementBonus,
  noteCompanionPassiveCombat,
  triggerScorchclaw,
  advanceScorchclawBurns,
} from './companion-passives';
import {
  advanceOwnedCompanions,
  ownedCompanion,
  noteCompanionCombat,
  companionDamageMultiplier,
  companionKilledMonster,
  companionSmitePose,
  grantCompanion,
} from './owned-companions';
import {
  COMPANION_SOURCE,
  companionStage,
  companionSmiteDamage,
} from '../content/companion-policy';
import type { OwnedCompanion } from './types';
import { SCUTTLER_SOURCE, SCUTTLER_POLICY } from '../content/scuttler-policy';
import type { RiverScuttlers } from './types';
import { LUX_BINDING_STOP_HISTORY_TICKS } from '../content/lux-binding-presentation';
import {
  MONSTERS,
  monsterSpawnClipTicks,
  type MonsterSpecies,
  type MonsterSpawnClip,
} from '../content/monsters';
import {
  RIFT_CAMPS,
  type RiftCampId,
  campLeadupTicks,
  campMemberHome,
  splitMemberHomes,
} from '../content/rift-camps';
import type { JungleCampState } from './types';
import type { BindingFlightStop } from './types';
import { impactTargetRig } from '../content/impact-target';
import { mobilePose } from '../render/mobile-pose';
import { mobileClipDurations } from '../content/mobile-clip-durations';
import { advanceAnimationTimeline } from './animation-timeline';
import { castAnimationDuration } from '../content/cast-animation';
import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';
import { LUX_BASIC_TRAIL } from '../content/lux-basic-trail';
import {
  LUX_ATTACK_VISUAL_TAIL_TICKS,
  LUX_ATTACK_PATH_FRAMES,
} from '../content/lux-attack-presentation';
import { LUX_IMPACT_HISTORY_TICKS } from '../content/lux-impact-presentation';
import type {
  LuxImpactVisual,
  LuxAttackVisual,
  LuxIlluminationVisual,
  GrompAttackVisual,
} from './types';
import {
  GROMP_ATTACK_PATH_FRAMES,
  GROMP_ATTACK_VISUAL_TAIL_TICKS,
} from '../content/gromp-attack-presentation';
import { LUX_ILLUMINATION_HISTORY_TICKS } from '../content/lux-illumination-presentation';
import { ASHE_FLURRY_INTERVAL_TICKS } from '../content/ashe-flurry-timing';
import { LUX_BINDING } from '../content/lux-binding';
import { LUX_ILLUMINATION } from '../content/lux-illumination';
import { LUX_E_SOURCE as LUX_E } from '../content/lux-e';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { DEATHCAP_AP_AMPLIFICATION, LOST_CHAPTER } from '../content/mage-items';
import { LUX_BOT_POLICY } from '../content/lux-bot-policy';
import { AHRI_BOT_POLICY } from '../content/ahri-bot-policy';
import { MASTER_YI_BOT_POLICY } from '../content/masteryi-bot-policy';
import { LEONA_BOT_POLICY } from '../content/leona-bot-policy';
import { luxWaveClear } from './lux-wave-clear';
import { ahriWaveClear } from './ahri-wave-clear';
import { botDisengagePoint } from './bot-disengage';
import { LUX_W } from '../content/lux-w';
import { LUX_R } from '../content/lux-r';
import { championProfile, isMeleeChampion } from '../content/champion-profiles';
import { MASTER_YI_PASSIVE } from '../content/masteryi-passive';
import { MASTER_YI_E } from '../content/masteryi-e';
import { MASTER_YI_W } from '../content/masteryi-w';
import { MASTER_YI_R } from '../content/masteryi-r';
import { MASTER_YI_Q } from '../content/masteryi-q';
import {
  alphaVanished,
  alphaTarget,
  beginAlphaStrike,
  settleAlphaStrike,
  advanceAlphaStrike,
  captureAlphaOrder,
  reduceAlphaCooldown,
} from './masteryi-alpha-strike';
import { MASTER_YI } from '../content/masteryi-progression';
import { activeHighlander, highlanderTakedown, HIGHLANDER_TICKS } from './masteryi-highlander';
import {
  beginMeditate,
  finishMeditate,
  settleMeditate,
  advanceMeditate,
  meditateReduction,
} from './masteryi-meditate';
import { wujuStyleDamage, WUJU_STYLE_TICKS } from './masteryi-wuju-style';
import {
  createDoubleStrikeState,
  countDoubleStrikeContact,
  expireDoubleStrike,
} from './masteryi-double-strike';
import { garenAttackWindupTicks, garenQAttackTimingAtLevel } from './garen-attack-timing';
import { GAREN_W } from '../content/garen-w';
import { GAREN } from '../content/garen-progression';
import { GAREN_R } from '../content/garen-r';
import { GAREN_R_WINDUP_TICKS, GAREN_R_REVEAL_TICKS } from '../content/garen-r-policy';
import { garenRDamage, GAREN_R_PRESENTATION_TAIL_TICKS } from './garen-r';
import { GAREN_W_AUDIO_TAIL_TICKS } from '../content/garen-w-audio-timing';
import { GAREN_W_DEFLECT_TAIL_TICKS } from '../content/garen-w-particle-timing';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../content/garen-q-audio-timing';
import { GAREN_E } from '../content/garen-e';
import {
  GAREN_E_DURATION_TICKS,
  GAREN_E_RECAST_TICKS,
  garenEStrikes,
  garenEStrikeTick,
  GAREN_E_PRESENTATION_TAIL_TICKS,
} from './garen-e';
import { GAREN_Q } from '../content/garen-q';
import { eclipseResistances, eclipseReducedRaw } from './leona-eclipse';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';
import { LEONA_SPELLS, LEONA_SUNLIGHT } from '../content/leona-spells';
import {
  leonaDaybreakValues,
  leonaEclipseValues,
  leonaZenithValues,
  leonaSolarFlareValues,
  leonaSpellResources,
  leonaSunlightDamage,
} from './leona-spell-values';
import { garenQLandingTick } from '../content/garen-q-presentation';
import { GAREN_PASSIVE } from '../content/garen-passive';
import { damageAfterResistance } from './damage-math';
import { CHAMPION_BASE_KILL_GOLD, FIRST_BLOOD_BONUS } from '../content/champion-kill-gold';
import { DORANS_BLADE_OMNIVAMP, MINION_AREA_OMNIVAMP_MULTIPLIER } from '../content/omnivamp';
import { HAWKSHOT_ASSIST_SECONDS } from '../content/hawkshot-assist';
import { ASSIST_WINDOW_SECONDS } from '../content/assist-window';
import { MINION_XP_SHARES } from '../content/minion-xp-sharing';
import {
  createChampionState,
  rechargeChampion,
  expireChampionFocus,
  expireGarenQ,
  finishGarenQPresentation,
} from './champion-state';
import { hastedCooldownTicks, totalAbilityHaste } from './ability-haste';
import { advanceBlueBuff, grantBlueBuff } from './blue-buff';
import {
  advanceRedBuff,
  advanceRedBuffClock,
  grantRedBuff,
  redBuffActive,
  cinderDamagePerTick,
  cinderSlow,
  CINDER_BURN_TICKS,
  CINDER_BURN_INTERVAL,
  RED_HEAL_LOCKOUT_TICKS,
} from './red-buff';
import { CREST_OF_CINDERS } from '../content/crest-of-cinders';
import { decodeSnapshot, encodeSnapshot, SNAPSHOT_RULESET, SNAPSHOT_VERSION } from './snapshot';
import { PRACTICE_FIXTURE } from '../content/practice-fixture';
import type { Battlefield } from './battlefield';
import {
  ABILITIES,
  DT,
  ITEMS,
  ITEM_RECIPES,
  RECALL_DURATION_TICKS,
  STRUCTURE_RESPAWN_TICKS,
  TICK_RATE,
} from '../content/rules';
import { ASHE } from '../content/ashe-progression';
import { AMBIENT_GOLD } from '../content/ambient-gold';
import { championDeathTicks } from './champion-death';
import { ASHE_Q } from '../content/ashe-q';
import { ASHE_E } from '../content/ashe-e';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../content/hawkshot-linger-timing';
import { ASHE_CASTS } from '../content/ashe-casting';
import { ASHE_R } from '../content/ashe-r';
import { ASHE_W } from '../content/ashe-w';
import { EXECUTION_CREDIT_SECONDS } from '../content/execution-credit';
import { CHAMPION_KILL_XP } from '../content/champion-kill-xp';
import { championKillExperience } from './champion-kill-experience';
import { ASHE_SKILL_RECOMMENDATION } from '../content/ashe-skill-recommendation';
import {
  asheCrystalArrowValues,
  asheVolleyValues,
  asheFocusValues,
  asheFocusFlurry,
  asheHawkshotValues,
  asheSpellResources,
} from './ashe-spell-values';
import { crystalArrowStunTicks, CRYSTAL_ARROW_RADIUS } from './crystal-arrow';
import { ASHE_PASSIVE } from '../content/ashe-passive';
import { CRITICAL_ATTACKS } from '../content/critical-attacks';
import { ASHE_ATTACK_PROJECTILE_SPEED } from '../content/ashe-projectiles';
import { SUMMONER_HEAL } from '../content/summoner-heal';
import { experienceToNextLevel, growthAtLevel, MAX_LEVEL, statPrecision } from './progression';
import { direction, distance, segmentDistance, Random, sweepCircle, type Vec2 } from './math';
import { seenFrom, sightRadius, type VisionArea, type VisionSource } from './vision';
import { isStructureKind, isLaneMinionKind } from './types';
import type {
  Ability,
  Command,
  Order,
  PlayerState,
  ChampionState,
  Projectile,
  SimEvent,
  Team,
  Faction,
  UnitBase,
  TeamUnit,
  Unit,
  UnitKind,
  ScoutVisual,
  LuxBeam,
  Singularity,
} from './types';

export class World {
  tick = 0;
  winner: Team | null = null;
  firstBloodClaimed = false;
  nextId = 1;
  matchMode: 'practice' | 'lanes' = 'practice';
  encounter: 'gromp' | null = null;
  jungleCamps: JungleCampState[] = [];
  pendingWards: WardPlacement[] = [];
  scuttlers: RiverScuttlers | null = null;
  companions: OwnedCompanion[] = [];
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  luxBeams: LuxBeam[] = [];
  luxAttackVisuals: LuxAttackVisual[] = [];
  grompAttackVisuals: GrompAttackVisual[] = [];
  luxImpactVisuals: LuxImpactVisual[] = [];
  luxIlluminationVisuals: LuxIlluminationVisual[] = [];
  sunlightVisuals: SunlightVisual[] = [];
  ahriOrbs: AhriOrb[] = [];
  ahriFoxFires: FoxFireCast[] = [];
  ahriRushes: SpiritRush[] = [];
  ahriCounters: EssenceCounter[] = [];
  ahriEssences: AhriEssence[] = [];
  nextSunlightVisual = 1;
  singularities: Singularity[] = [];
  luxEAudio = newLuxEAudioHistory();
  pendingAttackProjectiles: Projectile[] = [];
  events: SimEvent[] = [];
  commands: Command[] = [];
  teamPlans: Record<Team, TeamPlan> | null = null;
  random = new Random(26018);
  player: PlayerState;
  private championRecords = new Map<number, ChampionState>();
  private visionSnapshot?: {
    sources: (readonly VisionSource[] | undefined)[];
    units: [Map<Unit, boolean>, Map<Unit, boolean>];
  };
  championState(id: number): ChampionState | undefined {
    if (!this.championRecords.has(id)) return undefined;
    if (!this.units.some((u) => u.id === id && u.kind === 'champion')) return undefined;
    return this.player?.id === id ? this.player : this.championRecords.get(id);
  }
  private activeChampionStates(): ChampionState[] {
    return this.units.filter((u) => u.kind === 'champion').map((u) => this.championState(u.id)!);
  }
  wave = 0;
  nextWaveTick = 5 * TICK_RATE;
  reveal: { point: Vec2; endTick: number } | null = null;
  volleyHits: Record<number, number[]> = {};
  visionAreas: VisionArea[] = [];
  scoutVisuals: ScoutVisual[] = [];
  bindingStops: BindingFlightStop[] = [];
  // Local first choice; two source variants with avoid-repeat=1 alternate thereafter.
  nextBindingAudioVariant: 0 | 1 = 0;

  pendingSpawns: {
    tick: number;
    kind: Exclude<UnitKind, 'monster'>;
    team: Team;
    lane: number;
    offset: number;
  }[] = [];

  constructor(
    populate = true,
    readonly battlefield: Battlefield = PRACTICE_FIXTURE,
    playerChampion: import('./types').ChampionIdentity = 'ashe'
  ) {
    if (
      playerChampion === 'masteryi' &&
      !(
        (battlefield.id === 'practice-fixture' && battlefield.developmentMasterYi) ||
        (battlefield.id === 'rift' && battlefield.developmentMasterYiRift)
      )
    )
      throw new Error(
        'Master Yi requires a development NPC or trusted player practice/Rift context.'
      );
    if (
      playerChampion === 'ahri' &&
      !(
        (battlefield.id === 'practice-fixture' && battlefield.developmentAhri) ||
        (battlefield.id === 'rift' && battlefield.developmentAhriRift)
      )
    )
      throw new Error('Ahri requires a development NPC or trusted player practice/Rift context.');
    if (
      playerChampion === 'leona' &&
      battlefield.id !== 'practice-fixture' &&
      !battlefield.developmentLeona
    )
      throw new Error('Leona player kit requires the development practice fixture or Rift trial.');
    if (
      playerChampion === 'garen' &&
      battlefield.id !== 'practice-fixture' &&
      !battlefield.developmentGaren
    )
      throw new Error('Garen player kit requires the development practice fixture or Rift trial.');
    this.nextWaveTick = Math.round(battlefield.waves.initialSeconds * TICK_RATE);
    if (battlefield.id === 'rift') {
      this.scuttlers = newRiverScuttlers();
      this.jungleCamps = RIFT_CAMPS.map((camp) => ({
        id: camp.id as RiftCampId,
        unitIds: camp.members.map(() => null),
        cleanupTicks: camp.members.map(() => null),
        nextSpawnTick: camp.firstReadyTick,
        splitWaves: [],
      }));
    }
    const champion = this.spawn('champion', 'blue', battlefield.spawns.blue, playerChampion);
    this.player = this.championRecords.get(champion.id)!;
    if (populate)
      for (const initial of battlefield.initialUnits) {
        const unit = this.spawn(initial.kind, initial.team, initial.point);
        if (initial.name) unit.name = initial.name;
        if (initial.structureTransform) unit.structureTransform = [...initial.structureTransform];
        if (initial.structure) unit.structure = { ...initial.structure };
        if (initial.stats) {
          Object.assign(unit, initial.stats);
          unit.hp = unit.maxHp;
        }
        if (initial.ai !== undefined) unit.ai = initial.ai;
      }
  }

  get time(): number {
    return this.tick / TICK_RATE;
  }
  get hero(): TeamUnit {
    const hero = this.units.find((u) => u.id === this.player.id && u.kind === 'champion');
    if (!hero || hero.kind !== 'champion') throw new Error('Missing player champion');
    return hero;
  }
  unit(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }
  alive(unit: Unit): boolean {
    return unit.hp > 0;
  }
  emit(type: SimEvent['type'], p: Vec2, data: Partial<SimEvent> = {}): void {
    const unit = data.unit === undefined ? undefined : this.unit(data.unit);
    const privateFeedback = ['move', 'gold', 'message', 'level'].includes(type);
    // Hawkshot arrival belongs to its remote point, even when its owner is revealed.
    const unitAttached = unit !== undefined && type !== 'scout-arrival';
    const audience = (['blue', 'red'] as const).filter((team) =>
      privateFeedback
        ? team === (data.team ?? 'blue')
        : unit?.team === team ||
          this.pointVisible(p, team) ||
          (unitAttached && this.visible(unit, team))
    );
    this.events.push({
      id: this.nextId++,
      tick: this.tick,
      type,
      x: p.x,
      y: p.y,
      ...data,
      audience,
    });
  }
  private createUnitBase(
    kind: UnitKind,
    team: Faction,
    point: Vec2,
    identity: import('./types').ChampionIdentity = 'ashe'
  ): UnitBase {
    const champion = kind === 'champion',
      turret = kind === 'turret',
      dummy = kind === 'dummy',
      structure = isStructureKind(kind);
    const hp = champion
      ? 610
      : turret
        ? 3500
        : kind === 'nexus'
          ? 5500
          : kind === 'inhibitor'
            ? 4000
            : dummy
              ? 1500
              : kind === 'siege'
                ? 900
                : kind === 'melee'
                  ? 477
                  : 296;
    return {
      ...(champion ? { champion: identity } : {}),
      id: this.nextId++,
      name: champion ? 'Ashe' : turret ? 'Outer turret' : dummy ? 'Target dummy' : `${kind} minion`,
      x: point.x,
      y: point.y,
      previous: { x: point.x, y: point.y },
      facing: team === 'blue' ? 2.2 : -0.95,
      animationTimeline: null,
      runClock: null,
      idleClock: isStructureKind(kind) ? null : { startTick: this.tick, previous: 0, current: 0 },
      radius: champion ? 35 : turret ? 95 : dummy ? 40 : 27,
      hp,
      maxHp: hp,
      mana: champion ? 280 : 0,
      maxMana: champion ? 280 : 0,
      damage: champion ? 59 : turret ? 150 : structure ? 0 : kind === 'siege' ? 40 : 24,
      armor: champion ? 26 : turret ? 40 : 0,
      magicResist: structure ? 0 : 30,
      range: champion ? 600 : turret ? 775 : kind === 'melee' ? 110 : 550,
      speed: champion ? 325 : structure || dummy ? 0 : 325,
      attackPeriod: champion ? 91 : turret ? 72 : 80,
      windupTicks: champion ? 20 : turret ? 18 : 22,
      missileSpeed: champion
        ? ASHE_ATTACK_PROJECTILE_SPEED
        : turret
          ? 1500
          : kind === 'melee'
            ? 0
            : 1200,
      order: { type: 'idle' },
      path: [],
      pathTarget: null,
      pathDestination: null,
      nextPathTick: 0,
      lane: null,
      laneWaypoint: 0,
      attackTarget: null,
      attackCycle: null,
      releaseTick: null,
      nextAttackTick: 0,
      slowUntil: 0,
      slowMultiplier: 0.7,
      slows: [],
      criticalSlow: null,
      charm: null,
      stunUntil: 0,
      rootUntil: 0,
      silenceUntil: 0,
      shields: [],
      scorchclawBurns: [],
      illumination: [],
      sunlight: null,
      cinderBurn: null,
      garenEShreds: [],
      summonerHealReductionUntil: 0,
      summonerHealSpeedUntil: 0,
      deadAt: null,
      ai: !champion && !dummy && (!structure || turret),
      aiRetreating: false,
      nextThink: 0,
      respawnTick: null,
    };
  }
  spawn(
    kind: UnitKind,
    team: Team,
    point: Vec2,
    identity: import('./types').ChampionIdentity = 'ashe'
  ): TeamUnit {
    if (
      identity === 'ahri' &&
      this.battlefield.id !== 'practice-fixture' &&
      !this.battlefield.developmentAhriRift
    )
      throw new Error('Ahri simulation requires the development practice fixture or Rift trial.');
    if (
      identity === 'leona' &&
      this.battlefield.id !== 'practice-fixture' &&
      !this.battlefield.developmentLeona
    )
      throw new Error('Leona simulation requires the development practice fixture or Rift trial.');
    if (
      kind === 'champion' &&
      identity === 'masteryi' &&
      this.battlefield.id !== 'practice-fixture' &&
      !this.battlefield.developmentMasterYiRift
    )
      throw new Error('Master Yi requires a development practice NPC or trusted Rift context.');
    if (kind === 'monster') throw new Error('Use spawnMonster for neutral units.');
    if (kind === 'ward') throw new Error('Use a trinket placement to create a ward.');
    const stats = this.battlefield.unitStats?.[kind]?.[team];
    const champion = kind === 'champion',
      structure = isStructureKind(kind);
    const u: TeamUnit = { ...this.createUnitBase(kind, team, point, identity), kind, team };

    if (champion) {
      const profile = championProfile(identity);
      Object.assign(u, {
        hp: profile.hp,
        maxHp: profile.hp,
        mana: profile.mana,
        maxMana: profile.mana,
        damage: profile.damage,
        armor: profile.armor,
        magicResist: profile.magicResist,
        attackPeriod: Math.round(TICK_RATE / profile.attackSpeed),
      });
      Object.assign(u, {
        name: profile.name,
        speed: profile.speed,
        range: profile.range,
        windupTicks: profile.windupTicks,
        missileSpeed: profile.missileSpeed,
      });
    }
    if (stats) {
      Object.assign(u, stats);
      const health = isLaneMinionKind(kind)
        ? this.battlefield.unitHealthGrowth?.[kind]?.[team]
        : undefined;
      if (health && stats.maxHp !== undefined) {
        const upgrades = Math.max(
          0,
          Math.floor(this.tick / Math.round(health.intervalSeconds * TICK_RATE))
        );
        u.maxHp += Math.min(health.maxBonus, upgrades * health.increment);
      }
      u.hp = u.maxHp;
      const gold = isLaneMinionKind(kind)
        ? this.battlefield.unitGoldGrowth?.[kind]?.[team]
        : undefined;
      if (gold && stats.goldBounty !== undefined) {
        const upgrades = Math.max(
          0,
          Math.floor(this.tick / Math.round(gold.intervalSeconds * TICK_RATE))
        );
        u.goldBounty = Math.min(gold.maxTotal, stats.goldBounty + upgrades * gold.increment);
      }
      const growth = this.battlefield.waves.moveSpeed;
      if (growth && stats.speed !== undefined) {
        const upgrades = Math.max(
          0,
          Math.min(
            growth.maxUpgrades,
            1 + Math.floor((this.time - growth.startSeconds) / growth.intervalSeconds)
          )
        );
        u.speed += upgrades * growth.increment;
      }
    }
    if (kind === 'super') u.name = 'Super minion';
    if (structure) {
      u.structureKnowledge = { blue: null, red: null };
      u.structureIdle = {
        startTick: this.tick,
        observedStartTicks: { blue: this.tick, red: this.tick },
      };
    }
    if (champion)
      this.championRecords.set(
        u.id,
        createChampionState(u.id, this.battlefield.id === 'practice-fixture', this.tick)
      );
    const clipDurations = mobileClipDurations(u);
    if (clipDurations)
      u.animationTimeline = advanceAnimationTimeline(
        null,
        mobilePose(u, undefined, this.tick, 1, clipDurations),
        this.tick,
        clipDurations
      );
    this.units.push(u);
    if (champion && identity === 'ahri')
      this.ahriCounters.push({ sourceId: u.id, stacks: 0, lastKillTick: null });
    if (champion && identity !== 'ashe') {
      const own = this.championState(u.id)!;
      if (identity === 'masteryi') own.doubleStrike = createDoubleStrikeState();
      own.eCharges = 0;
      if (
        identity === 'garen' ||
        identity === 'leona' ||
        identity === 'ahri' ||
        identity === 'masteryi'
      ) {
        own.spellRanks = { q: 0, w: 0, e: 0, r: 0 };
        own.skillPoints = 1;
      }
    }
    return u;
  }
  spawnWard(placement: WardPlacement): TeamUnit {
    const u: TeamUnit = {
      ...this.createUnitBase('ward', placement.team, placement.point),
      kind: 'ward',
      team: placement.team,
      name: 'Stealth Ward',
      hp: WARD_SOURCE.health,
      maxHp: WARD_SOURCE.health,
      radius: WARD_SOURCE.radius,
      speed: 0,
      damage: 0,
      range: 0,
      armor: 0,
      magicResist: 0,
      missileSpeed: 0,
      ai: false,
      idleClock: null,
      corpseLifetimeTicks: WARD_POLICY.corpseTicks,
      goldBounty: WARD_POLICY.killGold,
      experienceBounty: WARD_SOURCE.sourceXP,
      ward: {
        ownerId: placement.ownerId,
        createdTick: this.tick,
        expireTick: this.tick + placement.lifeTicks,
        revealUntil: this.tick + WARD_POLICY.revealTicks,
      },
    };
    this.units.push(u);
    return u;
  }
  /** Spawn a neutral unit. Camp ownership/calendar is tracked independently. */
  spawnMonster(
    point: Vec2,
    spawn: { startTick: number; readyTick: number; clip?: MonsterSpawnClip } | null = null,
    species: MonsterSpecies = 'gromp'
  ): Extract<Unit, { kind: 'monster' }> {
    const base = this.createUnitBase('monster', 'neutral', point);
    const profile = MONSTERS[species];
    const { attackSpeed, ...stats } = profile.stats;
    const u: Extract<Unit, { kind: 'monster' }> = {
      ...base,
      kind: 'monster',
      team: 'neutral',
      name: profile.name,
      ...stats,
      radius: profile.radius,
      hp: profile.stats.maxHp,
      attackPeriod: Math.round(TICK_RATE / attackSpeed),
      windupTicks: profile.policy.windupTicks,
      missileSpeed: profile.missileSpeed,
      goldBounty: profile.gold,
      experienceBounty: profile.experience,
      ai: false,
      corpseLifetimeTicks: profile.policy.corpseLifetimeTicks,
      idleClock: spawn ? null : base.idleClock,
      monster: {
        species,
        ...(species === 'scuttler'
          ? {
              scuttle: {
                river:
                  distance(point, SCUTTLER_SOURCE.rivers.dragon.center) <
                  distance(point, SCUTTLER_SOURCE.rivers.baron.center)
                    ? ('dragon' as const)
                    : ('baron' as const),
                destination: 3,
                direction: -1 as const,
                nextThinkTick: spawn?.readyTick ?? this.tick,
                grazeUntil: null,
                fleeUntil: null,
                lastDamageTick: null,
              },
            }
          : {}),
        home: { x: point.x, y: point.y },
        phase: spawn && this.tick < spawn.readyTick ? 'spawning' : 'idle',
        targetId: null,
        spawn: spawn ? { ...spawn, clip: spawn.clip ?? 'spawn' } : null,
      },
    };
    const clips = mobileClipDurations(u)!;
    u.animationTimeline = advanceAnimationTimeline(
      null,
      mobilePose(u, undefined, this.tick, 1, clips),
      this.tick,
      clips
    );
    this.units.push(u);
    return u;
  }
  private advanceJungleCamps(): void {
    for (const camp of this.jungleCamps) {
      const definition = RIFT_CAMPS.find((c) => c.id === camp.id)!;
      for (const wave of camp.splitWaves) {
        if (wave.status !== 'pending' || this.tick < wave.readyTick) continue;
        const split = definition.splits.find((s) => s.parentSlot === wave.parentSlot)!;
        const homes = splitMemberHomes(definition, wave, this.battlefield);
        wave.status = 'spawned';
        const attacker = wave.targetId === null ? undefined : this.unit(wave.targetId);
        split.childSlots.forEach((slot, i) => {
          const child = this.spawnMonster(homes[i], null, split.species);
          child.facing = wave.facing;
          camp.unitIds[slot] = child.id;
          if (camp.unitIds[0] === null)
            camp.cleanupTicks[slot] = this.tick + definition.cleanupDelayTicks!;
          if (
            attacker &&
            this.alive(attacker) &&
            this.validTarget(child, attacker, true) &&
            distance(attacker, child.monster.home) <= MONSTERS[split.species].policy.leashRadius
          ) {
            child.monster.phase = 'engaged';
            child.monster.targetId = attacker.id;
            this.setOrder(child, { type: 'attack', target: attacker.id });
          }
        });
      }
      for (const [slot, cleanup] of camp.cleanupTicks.entries()) {
        if (cleanup === null) continue;
        const unit = this.unit(camp.unitIds[slot]!)!;
        const target = unit.monster?.targetId ? this.unit(unit.monster.targetId) : undefined;
        const fighting =
          unit.monster?.phase === 'engaged' &&
          target?.kind === 'champion' &&
          this.alive(target) &&
          distance(target, unit.monster.home) <=
            MONSTERS[unit.monster.species].policy.leashRadius &&
          this.validTarget(unit, target, true);
        if (fighting) camp.cleanupTicks[slot] = this.tick + definition.cleanupDelayTicks!;
        else if (this.tick >= cleanup) {
          unit.monster!.phase = 'idle';
          this.damage(
            unit,
            unit,
            unit.hp + unit.shields.reduce((n, s) => n + s.amount, 0),
            'true',
            'cleanup'
          );
        }
      }
      const leadup = campLeadupTicks(definition);
      if (camp.nextSpawnTick === null || this.tick < camp.nextSpawnTick - leadup) continue;
      const readyTick = camp.nextSpawnTick;
      camp.unitIds = definition.members.map((member, slot) => {
        if (slot >= definition.initialMemberCount) return null;
        const unit = this.spawnMonster(
          campMemberHome(definition, slot, this.battlefield),
          { startTick: readyTick - leadup, readyTick, clip: member.spawnClip },
          member.species
        );
        unit.facing = Math.atan2(
          definition.facingPoint.x - unit.x,
          definition.facingPoint.y - unit.y
        );
        return unit.id;
      });
      camp.cleanupTicks = definition.members.map(() => null);
      camp.splitWaves = [];
      camp.nextSpawnTick = null;
    }
  }
  private monsterGroup(
    unit: Extract<Unit, { kind: 'monster' }>
  ): Extract<Unit, { kind: 'monster' }>[] {
    const camp = this.jungleCamps.find((c) => c.unitIds.includes(unit.id));
    return camp
      ? camp.unitIds
          .map((id) => (id === null ? undefined : this.unit(id)))
          .filter(
            (u): u is Extract<Unit, { kind: 'monster' }> =>
              !!u && u.kind === 'monster' && this.alive(u)
          )
      : [unit];
  }
  private monsterResetGroup(
    unit: Extract<Unit, { kind: 'monster' }>
  ): Extract<Unit, { kind: 'monster' }>[] {
    const camp = this.jungleCamps.find((c) => c.unitIds.includes(unit.id));
    const leader = camp?.unitIds[0] ? this.unit(camp.unitIds[0]) : undefined;
    if (!leader || !this.alive(leader)) return [unit];
    const nearby = this.monsterGroup(unit).filter(
      (m) => m.id === leader.id || distance(m, leader) <= 700
    );
    return nearby.includes(unit) ? nearby : [unit];
  }
  private advanceMonster(u: Extract<Unit, { kind: 'monster' }>): boolean {
    const monster = u.monster,
      profile = MONSTERS[monster.species],
      target = monster.targetId === null ? undefined : this.unit(monster.targetId);
    if (monster.phase === 'spawning') {
      if (monster.spawn && this.tick < monster.spawn.readyTick) return true;
      monster.phase = 'idle';
    }
    if (
      monster.spawn &&
      this.tick >=
        monster.spawn.startTick +
          monsterSpawnClipTicks(monster.species, monster.spawn.clip) +
          (monster.species === 'scuttler' ? SCUTTLER_POLICY.hiddenTicks : 0)
    )
      monster.spawn = null;
    if (monster.species === 'scuttler') {
      advanceScuttler(this, u, (unit, point) => this.move(unit, point));
      return !u.charm;
    }
    if (u.charm && u.charm.endTick > this.tick) return false;
    if (
      monster.phase === 'engaged' &&
      (!target ||
        !this.alive(target) ||
        distance(u, monster.home) > profile.policy.leashRadius ||
        distance(target, monster.home) > profile.policy.leashRadius ||
        !this.validTarget(u, target, true))
    ) {
      for (const member of this.monsterResetGroup(u)) {
        member.monster.phase = 'returning';
        member.monster.targetId = null;
        member.sunlight = null;
        this.setOrder(member, { type: 'move', point: { ...member.monster.home } });
      }
    }
    // A temporarily untargetable aggressor still owns neutral aggro within
    // the existing sight/leash rules. Wait without attacking or reset healing.
    if (monster.phase === 'engaged' && target && !this.targetable(target)) {
      if (u.order.type !== 'idle' || u.releaseTick !== null) this.setOrder(u, { type: 'idle' });
      return true;
    }
    if (monster.phase === 'returning') {
      monster.targetId = null;
      if (
        u.order.type !== 'move' ||
        u.order.point.x !== monster.home.x ||
        u.order.point.y !== monster.home.y
      )
        this.setOrder(u, { type: 'move', point: { ...monster.home } });
      u.sunlight = null;
      u.releaseTick = null;
      u.attackCycle = null;
      u.stunUntil = u.rootUntil = u.slowUntil = 0;
      u.slows = [];
      u.cinderBurn = null;
      u.scorchclawBurns = [];
      u.criticalSlow = null;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * profile.policy.resetHealthFractionPerSecond * DT);
      this.move(u, monster.home);
      const group = this.monsterResetGroup(u);
      if (group.every((m) => distance(m, m.monster.home) < 3 && m.hp === m.maxHp)) {
        for (const member of group) {
          member.monster.phase = 'idle';
          this.setOrder(member, { type: 'idle' });
        }
      }
      return true;
    }
    if (
      monster.phase === 'engaged' &&
      target &&
      (u.order.type !== 'attack' || u.order.target !== target.id)
    )
      this.setOrder(u, { type: 'attack', target: target.id });
    return false;
  }
  enqueue(command: Command): void {
    if (this.winner) return;
    // Vec2 is structural: a caller may supply a Unit. Store only command data,
    // never an entity's mutable state inside its point or order.
    if (command.type === 'cast') {
      this.commands.push({
        type: 'cast',
        unit: command.unit,
        ability: command.ability,
        point: { x: command.point.x, y: command.point.y },
        ...(command.targetId !== undefined ? { targetId: command.targetId } : {}),
      });
    } else if (command.type === 'order') {
      const order = command.order;
      this.commands.push({
        type: 'order',
        unit: command.unit,
        order:
          order.type === 'attack'
            ? { type: 'attack', target: order.target }
            : order.type === 'idle'
              ? { type: 'idle' }
              : { type: order.type, point: { x: order.point.x, y: order.point.y } },
      });
    } else if (command.type === 'ward') {
      this.commands.push({
        type: 'ward',
        unit: command.unit,
        point: { x: command.point.x, y: command.point.y },
      });
    } else if (command.type === 'learn') {
      this.commands.push({ type: 'learn', unit: command.unit, ability: command.ability });
    } else if (command.type === 'oracle') {
      this.commands.push({ type: 'oracle', unit: command.unit });
    } else this.commands.push({ type: 'recall', unit: command.unit });
  }
  setOrder(u: Unit, order: Order): void {
    if (u.champion === 'masteryi' && captureAlphaOrder(this, u, order)) return;
    u.order = order;
    const state = this.championState(u.id);
    if (state?.meditate) finishMeditate(state, this, u, 'order');
    // Daybreak's released attack leaves no ordinary attack cooldown. An
    // explicit attack order may skip its automatic animation recovery.
    if (
      u.releaseTick === null &&
      u.champion === 'leona' &&
      u.attackCycle?.leonaQRank !== undefined &&
      order.type === 'attack'
    )
      u.attackCycle = null;
    const committedGarenQ =
      GAREN_Q.attackCannotCancelWindup &&
      !this.winner &&
      this.alive(u) &&
      u.releaseTick !== null &&
      u.attackCycle?.garenQRank !== undefined;
    if (
      !committedGarenQ &&
      !(u.champion === 'leona' && this.committedLeonaQ(u)) &&
      (order.type !== 'attack' || order.target !== u.attackTarget)
    ) {
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(
        u,
        this.winner ? 'match-end' : !this.alive(u) ? 'death' : 'order'
      );
      u.attackCycle = null;
    }
    u.path = [];
    u.pathTarget = null;
    u.pathDestination = null;
    u.nextPathTick = this.tick;
    if (state) {
      state.trinket.order = null;
      state.recallEnd = null;
      if (!state.pendingCast && !state.leonaEWindup && !(state.leonaR && !state.leonaR.released))
        state.castAnimation = null;
    }
  }
  step(count = 1): void {
    for (let i = 0; i < count && !this.winner; i++) {
      this.update();
      advanceLuxEAudio(this);
    }
  }
  private update(): void {
    const unseen = this.unseenBeforeHawkshot();
    this.tick++;
    if (this.teamPlans)
      for (const plan of Object.values(this.teamPlans))
        plan.assignments = plan.assignments.filter((g) => g.expiresTick > this.tick);
    if (this.luxIlluminationVisuals.length)
      this.luxIlluminationVisuals = this.luxIlluminationVisuals.filter(
        (v) => this.tick < v.startTick + LUX_ILLUMINATION_HISTORY_TICKS
      );
    if (this.luxImpactVisuals.length)
      this.luxImpactVisuals = this.luxImpactVisuals.filter(
        (v) => this.tick < v.startTick + LUX_IMPACT_HISTORY_TICKS
      );
    if (this.luxAttackVisuals.length)
      this.luxAttackVisuals = this.luxAttackVisuals.filter(
        (v) => v.stopTick === null || this.tick < v.stopTick + LUX_ATTACK_VISUAL_TAIL_TICKS
      );
    if (this.grompAttackVisuals.length)
      this.grompAttackVisuals = this.grompAttackVisuals.filter(
        (v) => v.stopTick === null || this.tick < v.stopTick + GROMP_ATTACK_VISUAL_TAIL_TICKS
      );
    for (const unit of this.units)
      if (unit.slows.length) unit.slows = unit.slows.filter((slow) => slow.endTick > this.tick);
    for (const unit of this.units)
      if (unit.shields.length)
        unit.shields = unit.shields.filter((shield) => shield.endTick > this.tick);
    if (this.luxBeams.length)
      this.luxBeams = this.luxBeams.filter(
        (beam) => this.tick < beam.startTick + LUX_R.presentationSeconds * TICK_RATE
      );
    for (const unit of this.units) {
      if (unit.illumination.length)
        unit.illumination = unit.illumination.filter((mark) => mark.endTick > this.tick);
      if (
        unit.sunlight &&
        (unit.sunlight.endTick <= this.tick || !this.championState(unit.sunlight.sourceId))
      )
        unit.sunlight = null;
    }
    for (const unit of this.units)
      if (unit.garenEShreds.length)
        unit.garenEShreds = unit.garenEShreds.filter((shred) => shred.endTick > this.tick);
    for (const state of this.activeChampionStates()) {
      if (state.alphaStrike) settleAlphaStrike(this, state, this.unit(state.id)!);
      if (state.meditate) settleMeditate(this, state, this.unit(state.id)!);
      if (state.doubleStrike) expireDoubleStrike(state.doubleStrike, this.tick);
      if (state.wujuStyle && this.tick >= state.wujuStyle.endTick) {
        stopWujuStyleAudio(state, this.unit(state.id)!, this, 'expired');
        state.wujuStyle = null;
      }
      if (state.wujuStyleAudio.length)
        state.wujuStyleAudio = state.wujuStyleAudio.filter(
          (r) => this.tick < wujuStyleAudioExpiry(r)
        );
      if (state.highlander && this.tick >= state.highlander.endTick) {
        stopHighlanderAudio(state, this.unit(state.id)!, this, 'expired');
        state.highlander = null;
      }
      if (state.highlanderAudio.length)
        state.highlanderAudio = state.highlanderAudio.filter(
          (r) => this.tick < highlanderAudioExpiry(r)
        );
      if (state.meditateAudio.length)
        state.meditateAudio = state.meditateAudio.filter(
          (record) => this.tick < meditateAudioExpiry(record)
        );
      if (state.meditateBuffVisuals.length)
        state.meditateBuffVisuals = state.meditateBuffVisuals.filter(
          (record) => this.tick < meditateBuffExpiry(record)
        );
      if (state.meditateCastVisuals.length)
        state.meditateCastVisuals = state.meditateCastVisuals.filter(
          (r) => this.tick < r.startTick + MEDITATE_CAST_HISTORY_TICKS
        );
      if (state.swordGlowVisuals.length)
        state.swordGlowVisuals = state.swordGlowVisuals.filter(
          (r) => this.tick < swordGlowExpiry(state, r)
        );
      if (state.meditateDamageVisuals.length)
        state.meditateDamageVisuals = state.meditateDamageVisuals.filter(
          (r) => this.tick < r.tick + MEDITATE_DAMAGE_HISTORY_TICKS
        );
      if (state.highlanderKillVisuals.length)
        state.highlanderKillVisuals = state.highlanderKillVisuals.filter(
          (r) => this.tick < r.tick + HIGHLANDER_KILL_HISTORY_TICKS
        );
      if (state.highlanderCastVisuals.length)
        state.highlanderCastVisuals = state.highlanderCastVisuals.filter(
          (r) => this.tick < r.startTick + HIGHLANDER_CAST_HISTORY_TICKS
        );
      if (state.alphaEndVisuals.length)
        state.alphaEndVisuals = state.alphaEndVisuals.filter(
          (r) => this.tick < r.startTick + ALPHA_END_HISTORY_TICKS
        );
      if (state.alphaCastVisuals.length)
        state.alphaCastVisuals = state.alphaCastVisuals.filter(
          (r) => this.tick < r.startTick + ALPHA_CAST_HISTORY_TICKS
        );
      if (state.alphaContactVisuals.length)
        state.alphaContactVisuals = state.alphaContactVisuals.filter(
          (r) => this.tick < r.tick + ALPHA_CONTACT_HISTORY_TICKS
        );
      if (state.alphaAudio.length)
        state.alphaAudio = state.alphaAudio.filter((r) => this.tick < alphaAudioExpiry(r));
      if (state.leonaQ && this.tick >= state.leonaQ.endTick) {
        finishDaybreakVisual(state, this.tick, 'expired');
        state.leonaQ = null;
      }
      if (state.masterYiAAAudio.length)
        state.masterYiAAAudio = state.masterYiAAAudio.filter(
          (r) => this.tick < masterYiAttackExpiry(r)
        );
      if (state.garenAAVisuals.length)
        state.garenAAVisuals = state.garenAAVisuals.filter((r) => this.tick < garenAttackExpiry(r));
      for (const r of state.garenQVisuals)
        for (const a of r.attacks)
          if (a.stopTick === null && this.tick >= a.endTick) {
            a.stopTick = a.endTick;
            a.endReason = 'complete';
          }
      if (state.garenQVisuals.length)
        state.garenQVisuals = state.garenQVisuals.filter(
          (r) => r.stopTick === null || this.tick < r.stopTick + GAREN_Q_AUDIO_TAIL_TICKS
        );
      if (
        state.garenEVisual &&
        state.garenEVisual.stopTick !== null &&
        this.tick >= state.garenEVisual.stopTick + GAREN_E_PRESENTATION_TAIL_TICKS
      )
        state.garenEVisual = null;
      const justice = state.garenRVisual;
      if (justice) {
        const ended = justice.releaseTick ?? justice.stopTick;
        if (ended !== null && this.tick >= ended + GAREN_R_PRESENTATION_TAIL_TICKS)
          state.garenRVisual = null;
      }
      const courage = state.garenWVisual;
      if (courage?.stopTick != null && this.tick >= courage.stopTick + GAREN_W_AUDIO_TAIL_TICKS)
        state.garenWVisual = null;
      if (state.garenWDeflects.length)
        state.garenWDeflects = state.garenWDeflects.filter(
          (reaction) => this.tick < reaction.tick + GAREN_W_DEFLECT_TAIL_TICKS
        );
      if (state.skillPoints === 0 || !this.unit(state.id)?.ai) continue;
      while (state.skillPoints > 0) {
        const allocated = Object.values(state.spellRanks).reduce((sum, rank) => sum + rank, 0);
        const recommendation =
          this.unit(state.id)?.champion === 'garen'
            ? { early: ['q', 'w', 'e'] as const, priority: ['r', 'e', 'q', 'w'] as const }
            : this.unit(state.id)?.champion === 'lux'
              ? LUX_BOT_POLICY
              : this.unit(state.id)?.champion === 'ahri'
                ? AHRI_BOT_POLICY
                : this.unit(state.id)?.champion === 'masteryi'
                  ? MASTER_YI_BOT_POLICY
                  : this.unit(state.id)?.champion === 'leona'
                    ? LEONA_BOT_POLICY
                    : ASHE_SKILL_RECOMMENDATION;
        const early = recommendation.early[allocated];
        const choices = early ? [early, ...recommendation.priority] : recommendation.priority;
        const ability = choices.find((key) => this.spellLearningError(key, state.id) === null);
        if (!ability) break;
        this.learnSpell(ability, state.id);
      }
    }
    // Serial recharge continues through death. Resolve before commands so a
    // newly restored charge can be used on its deadline tick.
    for (const state of this.activeChampionStates()) {
      advanceBlueBuff(state, this.unit(state.id)!, this.tick);
      if (state.redBuff && this.tick >= state.redBuff.endTick) state.redBuff = null;
      rechargeChampion(state, this.tick);
      expireGarenQ(state, this.tick);
      if (state.leonaW) this.advanceLeonaEclipse(state);
      if (state.leonaR) this.advanceLeonaSolarFlare(state);
      if (state.garenW && this.tick >= state.garenW.defenseUntil)
        this.finishGarenW(state, 'expired');
      if (
        state.garenRReveal &&
        (this.tick >= state.garenRReveal.endTick || !this.unit(state.garenRReveal.targetId))
      ) {
        if (state.pendingCast?.targetId === state.garenRReveal.targetId) {
          this.cancelGarenRVisual(state);
          state.pendingCast = null;
          state.castAnimation = null;
        }
        state.garenRReveal = null;
      }
    }
    this.visionAreas = this.visionAreas.filter((area) => area.endTick > this.tick);
    this.bindingStops = this.bindingStops.filter(
      (flight) => this.tick < flight.stopTick + LUX_BINDING_STOP_HISTORY_TICKS
    );
    this.scoutVisuals = this.scoutVisuals.filter((effect) => effect.endTick > this.tick);
    for (const unit of this.units) unit.previous = { x: unit.x, y: unit.y };
    for (const zone of this.singularities)
      if (zone.arrivalTick !== null && zone.detonatedTick === null && zone.endTick! > this.tick)
        this.slowSingularity(zone);
    advanceWards(this);
    // Expiry precedes input acceptance; a finished Charm never leaves a move order behind.
    for (const u of this.units)
      if (u.charm && this.tick >= u.charm.endTick) {
        u.charm = null;
        this.setOrder(u, { type: 'idle' });
      }
    expireSpiritRushes(this);
    const commands = this.commands.splice(0);
    for (const command of commands) {
      const u = this.unit(command.unit);
      if (!u || u.kind === 'monster' || u.kind === 'ward') continue;
      if (command.type === 'learn') {
        const error = this.learnSpell(command.ability, u.id);
        if (error) this.emit('message', u, { text: error, unit: u.id, team: u.team });
        continue;
      }
      if (!this.alive(u)) continue;
      const alpha = u.champion === 'masteryi' && this.championState(u.id)?.alphaStrike;
      if (
        alpha &&
        command.type !== 'order' &&
        !(
          command.type === 'cast' &&
          (command.ability === 'e' ||
            command.ability === 'r' ||
            ['heal', 'smite'].includes(this.summonerSpell(command.ability, u.id) ?? ''))
        )
      )
        continue;
      if (
        (u.stunUntil > this.tick || !!u.charm) &&
        !(command.type === 'cast' && this.abilitySpec(command.ability, u.id).canCastWhileDisabled)
      )
        continue;
      if (command.type === 'oracle') {
        const error = requestOracle(this, u);
        if (error) this.emit('message', u, { text: error, unit: u.id, team: u.team });
      } else if (command.type === 'ward') {
        const error = requestWard(this, u, command.point);
        if (error) this.emit('message', u, { text: error, unit: u.id, team: u.team });
      } else if (command.type === 'order') {
        this.setOrder(u, command.order);
        if (command.order.type === 'move' || command.order.type === 'attackMove')
          this.emit('move', command.order.point, { unit: u.id, team: u.team });
      } else if (command.type === 'cast')
        this.cast(u, command.ability, command.point, command.targetId);
      else {
        const state = this.championState(u.id);
        if (
          state &&
          !state.pendingCast &&
          !state.leonaEWindup &&
          !state.leonaDash &&
          !activeSpiritDash(this, u.id) &&
          !(state.leonaR && !state.leonaR.released) &&
          !state.garenE &&
          !this.committedLeonaQ(u) &&
          u.silenceUntil <= this.tick
        ) {
          this.setOrder(u, { type: 'idle' });
          state.recallEnd = this.tick + RECALL_DURATION_TICKS;
          this.emit('message', u, { text: 'Recalling…', unit: u.id, team: u.team });
        }
      }
    }
    let waveInterval = this.battlefield.waves.intervalSeconds;
    for (const change of this.battlefield.waves.intervalChanges ?? []) {
      if (this.tick === Math.round(change.startSeconds * TICK_RATE)) {
        // Preserve elapsed time toward the pending wave when its interval changes.
        this.nextWaveTick = Math.max(
          this.tick,
          this.nextWaveTick + Math.round((change.intervalSeconds - waveInterval) * TICK_RATE)
        );
      }
      if (this.time >= change.startSeconds) waveInterval = change.intervalSeconds;
    }
    if (this.tick >= this.nextWaveTick) {
      this.spawnWave();
      this.nextWaveTick += Math.round(waveInterval * TICK_RATE);
    }
    this.releaseWaveUnits();
    this.advanceJungleCamps();
    advanceRiverScuttlers(this);
    grantRiverSpeed(this);
    this.advanceTeamPlans();
    this.advanceCinderBurns();
    advanceScorchclawBurns(this);
    for (const u of this.units) {
      if (!this.alive(u)) {
        if (u.respawnTick !== null && this.tick >= u.respawnTick) this.respawn(u);
        continue;
      }
      if (u.kind === 'ward') continue;
      if (u.champion === 'masteryi') this.advanceDoubleStrike(u);
      if (this.winner) {
        this.advanceAttackVisuals();
        this.advanceAnimationClocks();
        this.advanceImpactVisuals();
        return;
      }
      if (u.champion === 'masteryi' && advanceAlphaStrike(this, u)) continue;
      if (u.champion === 'masteryi') this.planMasterYiMeditateSafety(u);
      if (u.champion === 'masteryi' && advanceMeditate(this, u)) continue;
      if (u.structure?.regenPerSecond)
        u.hp = Math.min(u.maxHp, u.hp + u.structure.regenPerSecond * DT);
      if (u.kind === 'monster' && this.advanceMonster(u)) continue;
      const thinkNow = u.ai && this.tick >= u.nextThink;
      if (thinkNow) {
        this.planDefensiveHeal(u);
        if (!u.charm) {
          this.planGarenW(u);
          this.planLeonaW(u);
        }
        u.nextThink = this.tick + 18;
      }
      const state = this.championState(u.id);
      if (activeSpiritDash(this, u.id)) {
        advanceSpiritDash(this, u);
        continue;
      }
      if (state?.leonaEWindup) {
        if (this.tick >= state.leonaEWindup.releaseTick) this.releaseZenith(u, state.leonaEWindup);
        continue;
      }
      if (state?.leonaDash) {
        if (this.committedLeonaQ(u)) this.advanceUnit(u, true);
        if (state.leonaDash && this.alive(u)) this.advanceLeonaDash(u, state);
        if (this.winner) {
          this.advanceAttackVisuals();
          this.advanceAnimationClocks();
          this.advanceImpactVisuals();
          return;
        }
        continue;
      }
      if (state?.leonaR && !state.leonaR.released) continue;
      if (state?.pendingCast) {
        const cast = state.pendingCast;
        if (this.tick < cast.releaseTick) continue;
        state.pendingCast = null;
        if (u.champion === 'garen' && cast.ability === 'r') {
          const target = this.unit(cast.targetId!);
          if (
            target &&
            target.kind === 'champion' &&
            target.team !== u.team &&
            this.alive(target)
          ) {
            if (state.garenRVisual) {
              state.garenRVisual.releaseTick = this.tick;
              state.garenRVisual.point = { x: target.x, y: target.y };
            }
            this.damage(u, target, garenRDamage(cast.rank, target.hp, target.maxHp), 'true');
            if (state.garenRVisual) state.garenRVisual.killed = target.deadAt === this.tick;
          } else this.cancelGarenRVisual(state);
        } else if (u.champion === 'lux' && cast.ability === 'r')
          this.releaseFinalSpark(u, cast.origin!, cast.point, cast.damage);
        else if (u.champion === 'lux' && cast.ability === 'w')
          this.releasePrismatic(u, cast.point, cast.shield!, cast.startTick);
        else if (u.champion === 'ahri' && cast.ability === 'q')
          beginAhriOrb(this, u, cast.point, cast.rank, cast.damage);
        else if (u.champion === 'ahri' && cast.ability === 'e') this.releaseCharm(u, cast);
        else if (u.champion === 'ahri' && cast.ability === 'w')
          releaseFoxFireCast(this, u, cast.startTick);
        else if (cast.ability === 'q') this.releaseLightBinding(u, cast.point, cast.damage);
        else if (u.champion === 'lux' && cast.ability === 'e') this.releaseSingularity(u, cast);
        else if (cast.ability === 'e') this.releaseHawkshot(u, cast.point);
        else this.releaseArrowSpell(u, cast.ability, cast.point, cast.damage, cast.rank);
      }
      if (u.stunUntil > this.tick) {
        // An already committed Decisive Strike completes while disabled. This
        // does not permit starting another attack or moving during the stun.
        if (
          (GAREN_Q.attackCanCastWhileDisabled &&
            u.releaseTick !== null &&
            u.attackCycle?.garenQRank !== undefined) ||
          this.committedLeonaQ(u)
        ) {
          this.advanceUnit(u);
          if (this.winner) {
            this.advanceAttackVisuals();
            this.advanceAnimationClocks();
            this.advanceImpactVisuals();
            return;
          }
          continue;
        }
        const state = this.championState(u.id);
        if (state) state.castAnimation = null;
        this.finishAttackPresentation(u, 'action');
        u.attackCycle = null;
        if (u.releaseTick !== null) {
          u.releaseTick = null;
          u.nextAttackTick = this.tick;
        }
        continue;
      }
      if (u.charm) {
        // Existing uncancellable empowered attacks finish; Charm cannot start another.
        if (u.releaseTick !== null) this.advanceUnit(u, true);
        if (this.winner) return;
        if (u.releaseTick === null) this.advanceCharm(u);
        continue;
      }
      if (thinkNow) this.think(u);
      this.advanceUnit(u);
      if (this.winner) {
        this.advanceAttackVisuals();
        this.advanceAnimationClocks();
        this.advanceImpactVisuals();
        return;
      }
    }
    this.creditHawkshotReveals(unseen);
    this.advanceGarenSpins();
    this.advanceProjectiles(unseen);
    advanceAhriOrbs(this);
    advanceFoxFires(this);
    advanceSpiritBolts(this);
    this.advanceSingularities();
    advanceEssences(this);
    advanceOracles(this);
    advanceOracleVisuals(this);
    if (this.winner) {
      this.advanceAnimationClocks();
      this.advanceImpactVisuals();
      return;
    }
    for (const unit of this.units) {
      const champion = this.championState(unit.id);
      if (champion) {
        for (const team of ['blue', 'red'] as const)
          if (unit.team === team || this.visible(unit, team)) {
            const previous = champion.observedStats[team];
            if (
              previous?.level !== champion.level ||
              previous.cs !== champion.cs ||
              previous.inventory.length !== champion.inventory.length ||
              previous.inventory.some((item, i) => item !== champion.inventory[i])
            )
              champion.observedStats[team] = {
                level: champion.level,
                cs: champion.cs,
                inventory: [...champion.inventory],
              };
          }
      }
      if (!unit.structureKnowledge) continue;
      for (const team of ['blue', 'red'] as const) {
        if (!this.visible(unit, team)) continue;
        unit.structureKnowledge[team] = this.alive(unit) ? null : unit.deadAt;
        if (unit.structureIdle && this.alive(unit))
          unit.structureIdle.observedStartTicks[team] = unit.structureIdle.startTick;
      }
    }
    for (const state of this.activeChampionStates()) {
      if (state.recallEnd === null || this.tick < state.recallEnd) continue;
      const h = this.unit(state.id)!;
      if (h.kind !== 'champion') continue;
      const home = this.battlefield.spawns[h.team];
      h.x = home.x;
      h.y = home.y;
      h.previous = { ...home };
      h.hp = h.maxHp;
      h.mana = h.maxMana;
      state.recallEnd = null;
      this.emit('heal', h, { value: h.maxHp, unit: h.id, team: h.team });
    }
    for (const state of this.activeChampionStates())
      advanceRedBuff(state, this.unit(state.id)!, this.tick);
    for (const h of this.units) {
      if (h.kind !== 'champion' || !this.alive(h)) continue;
      const owner = this.championState(h.id)!;
      const enlighten = owner.enlighten;
      if (enlighten && this.tick > enlighten.startTick) {
        h.mana = Math.min(
          h.maxMana,
          h.mana + enlighten.totalMana / (LOST_CHAPTER.durationSeconds * TICK_RATE)
        );
        if (this.tick >= enlighten.endTick) owner.enlighten = null;
      }
      const fountain = distance(h, this.battlefield.spawns[h.team]) < 220;
      const growth = growthAtLevel(this.championState(h.id)?.level ?? 1);
      const profile = championProfile(h.champion!);
      h.hp = Math.min(
        h.maxHp,
        h.hp +
          ((fountain ? h.maxHp * 0.09 : profile.healthRegen + profile.healthRegenGrowth * growth) +
            this.perseveranceRegenPerSecond(h)) *
            DT
      );
      h.mana = Math.min(
        h.maxMana,
        h.mana +
          (fountain ? h.maxMana * 0.12 : profile.manaRegen + profile.manaRegenGrowth * growth) * DT
      );
    }
    for (const unit of this.units)
      if (unit.champion === 'garen')
        advancePerseveranceVisual(this.championState(unit.id)!, unit, this.tick);
    // Continuous fractional accrual is our cadence policy; see docs/ECONOMY.md.
    if (this.tick > AMBIENT_GOLD.startSeconds * TICK_RATE)
      for (const state of this.activeChampionStates())
        state.gold = statPrecision(
          state.gold + (AMBIENT_GOLD.amount / AMBIENT_GOLD.intervalSeconds) * DT
        );
    for (const state of this.activeChampionStates()) expireChampionFocus(state, this.tick);
    advanceOwnedCompanions(this);
    this.advanceAnimationClocks();
    this.advanceImpactVisuals();
    this.events = this.events.filter((e) => this.tick - e.tick < 150);
    this.units = this.units.filter(
      (u) =>
        isStructureKind(u.kind) ||
        u.deadAt === null ||
        u.respawnTick !== null ||
        this.tick - u.deadAt < (u.corpseLifetimeTicks ?? 4 * TICK_RATE)
    );
    if (this.tick % 120 === 0)
      for (const key of Object.keys(this.volleyHits)) {
        if (!this.projectiles.some((p) => p.volleyId === Number(key)))
          delete this.volleyHits[Number(key)];
      }
  }
  private spawnWave(): void {
    this.wave++;
    for (let lane = 0; lane < this.battlefield.lanes.length; lane++) {
      for (const team of ['blue', 'red'] as const) {
        // Sample the defender state at the wave deadline. A queued wave keeps
        // its composition while its individual units leave the barracks.
        const inhibitors = this.units.filter(
          (u) =>
            u.team !== team &&
            u.kind === 'inhibitor' &&
            !this.alive(u) &&
            (u.respawnTick === null || u.respawnTick > this.tick)
        );
        this.battlefield
          .waveKinds(this.wave, this.time, {
            enemyLaneInhibitorDown: inhibitors.some(
              (u) => u.structure?.lane === this.battlefield.lanes[lane].name
            ),
            enemyInhibitorsDown: inhibitors.length,
          })
          .forEach((kind, offset) => {
            if (kind === 'monster') throw new Error('Wave cannot spawn neutral monsters');
            this.pendingSpawns.push({
              tick:
                this.tick +
                Math.round(offset * this.battlefield.waves.unitIntervalSeconds * TICK_RATE),
              kind,
              team,
              lane,
              offset,
            });
          });
      }
    }
  }
  private releaseWaveUnits(): void {
    const ready = this.pendingSpawns.filter((spawn) => spawn.tick <= this.tick);
    this.pendingSpawns = this.pendingSpawns.filter((spawn) => spawn.tick > this.tick);
    for (const spawn of ready) {
      const lane = this.battlefield.lanes[spawn.lane],
        start = lane.spawns[spawn.team];
      const first = spawn.team === 'blue' ? 0 : lane.points.length - 1;
      const directionPoint = lane.points[first + (spawn.team === 'blue' ? 1 : -1)];
      const dir = direction(start, directionPoint);
      const position =
        this.battlefield.waves.unitIntervalSeconds === 0
          ? { x: start.x - dir.x * spawn.offset * 100, y: start.y - dir.y * spawn.offset * 100 }
          : start;
      const u = this.spawn(spawn.kind, spawn.team, position);
      const spawnPoint = this.battlefield.reachable(position, u.radius, spawn.team);
      Object.assign(u, spawnPoint);
      u.previous = { ...spawnPoint };
      u.lane = spawn.lane;
      u.laneWaypoint = first;
      u.order = { type: 'attackMove', point: lane.points[first] };
    }
  }
  visible(u: Unit, team: Faction = 'blue'): boolean {
    if (team === 'neutral') return false;
    const cache = this.visionSnapshot?.units[team === 'red' ? 1 : 0];
    const cached = cache?.get(u);
    if (cached !== undefined) return cached;
    const visible = this.unitVisible(u, team);
    cache?.set(u, visible);
    return visible;
  }
  private unitVisible(u: Unit, team: Team): boolean {
    if (u.kind === 'ward' && u.team !== team) {
      if (wardDetected(this, u, team)) return true;
      if (this.tick >= u.ward!.revealUntil) return false;
    }
    if (
      u.kind === 'monster' &&
      u.monster.species === 'scuttler' &&
      u.monster.spawn &&
      this.tick < u.monster.spawn.startTick + SCUTTLER_POLICY.hiddenTicks
    )
      return false;
    if (u.team === team || this.pointVisible(u, team)) return true;
    return this.units.some((source) => {
      if (source.champion !== 'garen' || source.team !== team) return false;
      const reveal = this.championState(source.id)?.garenRReveal;
      return !!reveal && reveal.targetId === u.id && this.tick < reveal.endTick;
    });
  }
  knownStructureDestroyed(u: Unit, team: Team = 'blue'): boolean | null {
    if (!u.structureKnowledge) return null;
    return this.visible(u, team) ? !this.alive(u) : u.structureKnowledge[team] !== null;
  }
  knownStructureDeathTick(u: Unit, team: Team = 'blue'): number | null {
    if (!u.structureKnowledge) return null;
    return this.visible(u, team) ? u.deadAt : u.structureKnowledge[team];
  }
  knownStructureIdleStartTick(u: Unit, team: Team = 'blue'): number | null {
    if (!u.structureIdle) return null;
    return this.visible(u, team)
      ? u.structureIdle.startTick
      : u.structureIdle.observedStartTicks[team];
  }
  /** Reuse source lists and unit visibility during synchronous presentation reads. Callers must not
   * mutate the match inside this scope; simulation queries outside stay fresh,
   * including multiple changes within the same tick. Nested reads share the
   * current scope and exceptions always release it. Nothing here is saved. */
  withVisionSnapshot<T>(read: () => T): T {
    const previous = this.visionSnapshot;
    this.visionSnapshot ??= { sources: [], units: [new Map(), new Map()] };
    try {
      return read();
    } finally {
      this.visionSnapshot = previous;
    }
  }
  visionSources(
    team: Faction = 'blue',
    includeAttackReveals = true,
    includeHawkshots = true
  ): readonly VisionSource[] {
    if (team === 'neutral') return [];
    const key =
      (team === 'red' ? 4 : 0) + (includeAttackReveals ? 2 : 0) + (includeHawkshots ? 1 : 0);
    const cached = this.visionSnapshot?.sources[key];
    if (cached) return cached;
    const sources: VisionSource[] = [];
    for (const u of this.units)
      if (u.team === team && this.alive(u) && (u.kind !== 'ward' || !wardDisabled(this, u)))
        sources.push({ x: u.x, y: u.y, radius: sightRadius(u) });
    for (const shrine of this.scuttlers?.shrines ?? [])
      if (shrine.team === team && shrine.endTick > this.tick)
        sources.push({
          ...shrinePoint(shrine.river, this.battlefield),
          radius: SCUTTLER_POLICY.shrineSightRadius,
        });
    for (const a of this.visionAreas)
      if (
        a.team === team &&
        a.endTick > this.tick &&
        (includeAttackReveals || a.kind === 'scout') &&
        (includeHawkshots || a.kind !== 'scout')
      )
        sources.push(a);
    for (const projectile of this.projectiles)
      if (projectile.team === team && projectile.type === 'ultimate')
        sources.push({ x: projectile.x, y: projectile.y, radius: ASHE_R.sightRadius });
    if (includeHawkshots)
      for (const projectile of this.projectiles)
        if (projectile.team === team && projectile.type === 'hawkshot')
          // Radius remains provisional until reference geometry is verified.
          sources.push({
            x: projectile.x,
            y: projectile.y,
            radius: 650,
            unobstructed: true,
          });
    for (const z of this.singularities)
      if (
        z.team === team &&
        z.arrivalTick !== null &&
        z.detonatedTick === null &&
        z.endTick! > this.tick
      )
        sources.push({ x: z.x, y: z.y, radius: LUX_E.visionRadius, unobstructed: true });
    if (team === 'blue' && this.reveal && this.reveal.endTick > this.tick)
      sources.push({ ...this.reveal.point, radius: 650, unobstructed: true });
    if (this.visionSnapshot) this.visionSnapshot.sources[key] = sources;
    return sources;
  }
  pointVisible(point: Vec2, team: Faction = 'blue'): boolean {
    return seenFrom(point, this.visionSources(team), this.battlefield.lineOfSight);
  }
  projectileVisible(projectile: Projectile, team: Faction = 'blue'): boolean {
    return projectile.team === team || this.pointVisible(projectile, team);
  }
  eventVisible(event: SimEvent, team: Team = 'blue'): boolean {
    return event.audience.includes(team);
  }
  targetable(unit: Unit): boolean {
    return (
      this.alive(unit) &&
      this.vulnerable(unit) &&
      (unit.champion !== 'masteryi' || !alphaVanished(this.championState(unit.id)))
    );
  }
  vulnerable(unit: Unit): boolean {
    if (
      unit.kind === 'monster' &&
      unit.monster.phase === 'spawning' &&
      this.tick < (unit.monster.spawn?.readyTick ?? Infinity)
    )
      return false;
    if (!unit.structure) return true;
    const peers = this.units.filter((u) => u.team === unit.team && u.structure);
    const aliveRole = (role: NonNullable<Unit['structure']>['role'], lane = unit.structure!.lane) =>
      peers.some((u) => u.structure!.role === role && u.structure!.lane === lane && this.alive(u));
    switch (unit.structure.role) {
      case 'outer-turret':
        return true;
      case 'inner-turret':
        return !aliveRole('outer-turret');
      case 'inhibitor-turret':
        return !aliveRole('outer-turret') && !aliveRole('inner-turret');
      case 'inhibitor':
        return (
          !aliveRole('outer-turret') && !aliveRole('inner-turret') && !aliveRole('inhibitor-turret')
        );
      case 'nexus-turret':
        return peers.some((u) => u.kind === 'inhibitor' && !this.alive(u));
      case 'nexus':
        return (
          peers.some((u) => u.kind === 'inhibitor' && !this.alive(u)) &&
          !aliveRole('nexus-turret', null)
        );
    }
  }
  private validTarget(u: Unit, target: Unit | undefined, retainAggro = false): target is Unit {
    return (
      !!target &&
      target.team !== u.team &&
      this.alive(target) &&
      (retainAggro ? this.vulnerable(target) : this.targetable(target)) &&
      (target.kind !== 'ward' || u.kind === 'champion') &&
      (target.kind !== 'monster' ||
        (target.monster.phase !== 'returning' &&
          u.kind === 'champion' &&
          (!u.ai || (u.order.type === 'attack' && u.order.target === target.id)))) &&
      (u.kind === 'monster'
        ? target.kind !== 'monster' &&
          !isStructureKind(target.kind) &&
          distance(u, target) <= MONSTERS[u.monster.species].policy.sightRadius &&
          this.battlefield.lineOfSight(u, target)
        : this.visible(target, u.team))
    );
  }
  private nearest(
    u: Unit,
    range: number,
    championsOnly = false,
    accept?: (target: Unit) => boolean
  ): Unit | undefined {
    let best: Unit | undefined,
      bestDistance = Infinity;
    for (const target of this.units)
      if (
        target.team !== u.team &&
        this.alive(target) &&
        target.kind !== 'dummy' &&
        (target.kind !== 'monster' || (u.kind === 'champion' && !u.ai)) &&
        (!championsOnly || target.kind === 'champion')
      ) {
        const d = distance(u, target) - target.radius;
        const score = d + (target.kind === 'champion' && u.kind !== 'champion' ? 300 : 0);
        if (
          d < range &&
          score < bestDistance &&
          this.validTarget(u, target) &&
          (!accept || accept(target))
        ) {
          bestDistance = score;
          best = target;
        }
      }
    return best;
  }
  private planDefensiveHeal(u: Unit): void {
    const slot = this.summonerSlot('heal', u.id);
    if (
      !slot ||
      u.kind !== 'champion' ||
      u.hp >= u.maxHp * 0.22 ||
      distance(u, this.battlefield.spawns[u.team]) <= 400 ||
      this.abilityCooldownTicks(slot, u.id) > 0
    )
      return;
    const threatened = this.units.some(
      (enemy) =>
        enemy.kind === 'champion' &&
        enemy.team !== u.team &&
        this.alive(enemy) &&
        distance(u, enemy) <= 1150 &&
        this.visible(enemy, u.team)
    );
    if (threatened)
      this.enqueue({ type: 'cast', unit: u.id, ability: slot, point: { x: u.x, y: u.y } });
  }
  private planGarenW(u: Unit): void {
    if (u.champion !== 'garen' || u.stunUntil > this.tick || u.silenceUntil > this.tick) return;
    const state = this.championState(u.id)!;
    if (!state.spellRanks.w || state.garenW || this.abilityCooldownTicks('w', u.id) > 0) return;
    // Leave a small margin inside the shield window for next-tick command dispatch.
    // Forecast only observable, committed attacks against a stationary target.
    const horizon = Math.floor(GAREN_W.upfrontSeconds * TICK_RATE) - 3;
    if (this.observedAttackWithin(u, horizon))
      this.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: { x: u.x, y: u.y } });
  }
  private planLeonaW(u: Unit): void {
    if (u.champion !== 'leona' || u.stunUntil > this.tick || u.silenceUntil > this.tick) return;
    const state = this.championState(u.id)!;
    if (
      !state.spellRanks.w ||
      state.leonaW ||
      this.abilityCooldownTicks('w', u.id) > 0 ||
      u.mana < this.abilityResources('w', u.id).mana
    )
      return;
    if (this.observedAttackWithin(u, LEONA_BOT_POLICY.defenseHorizonTicks))
      this.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: { x: u.x, y: u.y } });
  }
  private queuedCastMana(u: Unit): number {
    return this.commands.reduce(
      (mana, command) =>
        mana +
        (command.type === 'cast' && command.unit === u.id
          ? this.abilityResources(command.ability, u.id).mana
          : 0),
      0
    );
  }
  private leonaZenithReady(u: Unit): u is TeamUnit {
    if (
      u.champion !== 'leona' ||
      u.team === 'neutral' ||
      u.stunUntil > this.tick ||
      u.silenceUntil > this.tick ||
      u.rootUntil > this.tick ||
      u.releaseTick !== null
    )
      return false;
    const state = this.championState(u.id)!;
    if (
      !state.spellRanks.e ||
      state.leonaEWindup ||
      state.leonaDash ||
      state.leonaR ||
      state.pendingCast ||
      state.recallEnd !== null ||
      this.abilityCooldownTicks('e', u.id) > 0 ||
      u.mana < this.abilityResources('e', u.id).mana + this.queuedCastMana(u) ||
      this.projectiles.some((p) => p.type === 'zenith' && p.source === u.id) ||
      this.threateningTower(u, u, true)
    )
      return false;
    return true;
  }
  /** Conservative local follow-up on an isolated, observed immobilized champion. */
  private planLeonaE(u: Unit): boolean {
    if (!this.leonaZenithReady(u)) return false;
    // Observe sight before consulting enemy health, control clocks or positions.
    const enemies = this.units.filter(
      (other) =>
        other.kind === 'champion' &&
        other.team !== u.team &&
        this.visible(other, u.team) &&
        this.alive(other)
    );
    const reach = LEONA_SPELLS.e.missile.castRange;
    // Hold through next-tick dispatch, windup and the complete outward flight.
    const heldUntil =
      this.tick +
      1 +
      LEONA_COMBAT_POLICY.zenithWindupTicks +
      Math.ceil(reach / (LEONA_SPELLS.e.missile.speed * DT));
    for (const target of [...enemies].sort(
      (a, b) => distance(u, a) - distance(u, b) || a.id - b.id
    )) {
      const d = distance(u, target);
      if (
        !this.targetable(target) ||
        d <= this.attackRange(u) + target.radius ||
        d > reach ||
        Math.max(target.rootUntil, target.stunUntil) < heldUntil
      )
        continue;
      const away = direction(target, u),
        dir = direction(u, target),
        landing = {
          x: target.x + away.x * (u.radius + target.radius),
          y: target.y + away.y * (u.radius + target.radius),
        },
        end = { x: u.x + dir.x * reach, y: u.y + dir.y * reach };
      if (
        enemies.some(
          (other) =>
            other.id !== target.id &&
            (distance(other, landing) <= LEONA_BOT_POLICY.zenithIsolationRadius ||
              sweepCircle(u, end, other, LEONA_COMBAT_POLICY.zenithRadius + other.radius) !== null)
        )
      )
        continue;
      if (
        this.threateningTower(u, landing, true) ||
        !this.battlefield.lineWalkable(u, landing, u.radius, u.team) ||
        distance(landing, this.battlefield.reachable(landing, u.radius, u.team)) > 1
      )
        continue;
      // Hold the checked launch position until ordinary next-tick dispatch.
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: target.x, y: target.y } });
      return true;
    }
    return false;
  }
  /** Support an observed allied attack without requiring a pre-existing hold. */
  private planLeonaSupportedE(u: Unit): boolean {
    if (!this.leonaZenithReady(u)) return false;
    const state = this.championState(u.id)!;
    const preparedQ =
      !!state.leonaQ &&
      state.leonaQ.endTick >= this.tick + LEONA_BOT_POLICY.supportEngageQMinimumTicks;
    if (
      state.role !== 'support' ||
      u.hp < u.maxHp * LEONA_BOT_POLICY.supportEngageHealth ||
      !state.spellRanks.q ||
      (!preparedQ && this.abilityCooldownTicks('q', u.id) > 0)
    )
      return false;
    const queued = new Set(
      this.commands.flatMap((command) =>
        command.type === 'cast' && command.unit === u.id ? [command.ability] : []
      )
    );
    let budget = this.abilityResources('e', u.id).mana + this.queuedCastMana(u);
    if (!preparedQ && !queued.has('q')) budget += this.abilityResources('q', u.id).mana;
    if (
      state.spellRanks.w &&
      !state.leonaW &&
      !queued.has('w') &&
      this.abilityCooldownTicks('w', u.id) === 0
    )
      budget += this.abilityResources('w', u.id).mana;
    if (u.mana < budget) return false;
    const enemies = this.units.filter(
      (other) =>
        other.kind === 'champion' &&
        other.team !== u.team &&
        this.visible(other, u.team) &&
        this.alive(other)
    );
    const reach = LEONA_SPELLS.e.missile.castRange,
      flightTicks =
        1 +
        LEONA_COMBAT_POLICY.zenithWindupTicks +
        Math.ceil(reach / (LEONA_SPELLS.e.missile.speed * DT));
    for (const target of [...enemies].sort(
      (a, b) => distance(u, a) - distance(u, b) || a.id - b.id
    )) {
      const d = distance(u, target);
      if (!this.targetable(target) || d <= this.attackRange(u) + target.radius || d > reach)
        continue;
      const away = direction(target, u),
        dir = direction(u, target),
        landing = {
          x: target.x + away.x * (u.radius + target.radius),
          y: target.y + away.y * (u.radius + target.radius),
        },
        end = { x: u.x + dir.x * reach, y: u.y + dir.y * reach };
      const supporters = this.units.filter(
        (ally) =>
          ally.id !== u.id &&
          ally.kind === 'champion' &&
          ally.team === u.team &&
          this.visible(ally, u.team) &&
          this.alive(ally) &&
          ally.hp >= ally.maxHp * LEONA_BOT_POLICY.supportEngageAllyHealth &&
          ally.stunUntil <= this.tick &&
          !ally.charm &&
          !ally.aiRetreating &&
          distance(ally, target) <= this.attackRange(ally) + target.radius &&
          ((ally.order.type === 'attack' && ally.order.target === target.id) ||
            (ally.releaseTick !== null && ally.attackTarget === target.id))
      );
      const threats = enemies.filter(
        (other) => distance(other, landing) <= LEONA_BOT_POLICY.zenithIsolationRadius
      ).length;
      if (!supporters.length || supporters.length + 1 < threats) continue;
      // Zenith dashes to its last champion contact. Reject an observed later
      // contact instead of checking safety against the wrong landing target.
      const contact = sweepCircle(u, end, target, LEONA_COMBAT_POLICY.zenithRadius + target.radius);
      if (
        contact === null ||
        enemies.some((other) => {
          if (other.id === target.id) return false;
          const hit = sweepCircle(u, end, other, LEONA_COMBAT_POLICY.zenithRadius + other.radius);
          return hit !== null && hit >= contact;
        }) ||
        this.knownTeamTowers(u.team).some(
          (tower) =>
            distance(tower, landing) <=
            tower.range + u.radius + 100 + this.movementSpeed(target) * DT * flightTicks
        ) ||
        !this.battlefield.lineWalkable(u, landing, u.radius, u.team) ||
        distance(landing, this.battlefield.reachable(landing, u.radius, u.team)) > 1
      )
        continue;
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: target.x, y: target.y } });
      return true;
    }
    return false;
  }
  /** Local delayed-area follow-up; uses only currently observed held champions. */
  private planLeonaR(u: Unit): boolean {
    if (
      u.champion !== 'leona' ||
      u.stunUntil > this.tick ||
      u.silenceUntil > this.tick ||
      u.releaseTick !== null
    )
      return false;
    const state = this.championState(u.id)!;
    if (
      !state.spellRanks.r ||
      state.leonaR ||
      state.leonaEWindup ||
      state.leonaDash ||
      state.pendingCast ||
      state.recallEnd !== null ||
      this.abilityCooldownTicks('r', u.id) > 0 ||
      u.mana < this.abilityResources('r', u.id).mana + this.queuedCastMana(u) ||
      this.projectiles.some((p) => p.type === 'zenith' && p.source === u.id) ||
      this.threateningTower(u, u, true)
    )
      return false;
    const impactTick = this.tick + 1 + LEONA_COMBAT_POLICY.solarImpactTicks,
      held = this.units.filter(
        (target) =>
          target.kind === 'champion' &&
          target.team !== u.team &&
          this.visible(target, u.team) &&
          this.alive(target) &&
          this.targetable(target) &&
          Math.max(target.rootUntil, target.stunUntil) >= impactTick
      ),
      raw = leonaSolarFlareValues(state.spellRanks.r, this.abilityPower(u)).magicDamage;
    const candidates = held
      .filter((target) => distance(u, target) <= LEONA_SPELLS.r.castRange)
      .map((target) => ({
        target,
        count: held.filter(
          (other) => distance(target, other) <= LEONA_SPELLS.r.authoredOuterRadius + other.radius
        ).length,
        // Preserve melee follow-through rather than spend R on a lone nearby unit.
        finish:
          distance(u, target) > this.attackRange(u) + target.radius &&
          target.hp + this.shieldAmount(target) <= this.mitigatedDamage(target, raw, 'magic'),
      }))
      .filter(({ count, finish }) => count >= LEONA_BOT_POLICY.solarMinimumHeldTargets || finish)
      .sort(
        (a, b) =>
          b.count - a.count ||
          Number(b.finish) - Number(a.finish) ||
          distance(u, a.target) - distance(u, b.target) ||
          a.target.id - b.target.id
      );
    const target = candidates[0]?.target;
    if (!target) return false;
    if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    this.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: target.x, y: target.y } });
    return true;
  }
  /** Stationary-target forecast of visible, committed champion/turret attacks. */
  private observedAttackWithin(u: Unit, horizon: number): boolean {
    const incoming = this.projectiles.some((p) => {
      if (
        p.type !== 'attack' ||
        p.team === u.team ||
        p.target !== u.id ||
        p.speed <= 0 ||
        !this.projectileVisible(p, u.team)
      )
        return false;
      const source = this.unit(p.source);
      if (!source || (source.kind !== 'champion' && source.kind !== 'turret')) return false;
      const travel = Math.max(0, distance(p, u) - p.radius - u.radius);
      const ticks = Math.ceil(travel / (p.speed * DT));
      return travel <= p.remaining && ticks > 1 && ticks <= horizon;
    });
    const windingUp = this.units.some((source) => {
      if (
        source.team === u.team ||
        (source.kind !== 'champion' && source.kind !== 'turret') ||
        !this.visible(source, u.team) ||
        !this.alive(source) ||
        source.attackTarget !== u.id ||
        source.releaseTick === null
      )
        return false;
      const daybreak = source.champion === 'leona' && this.committedLeonaQ(source);
      if (source.stunUntil > this.tick && source.attackCycle?.garenQRank === undefined && !daybreak)
        return false;
      // Reach was checked when the windup committed. A later displacement does
      // not cancel that attack, so nominal range cannot discard its forecast.
      const flight =
        source.missileSpeed > 0
          ? Math.ceil(Math.max(0, distance(source, u) - u.radius - 8) / (source.missileSpeed * DT))
          : 0;
      const ticks = source.releaseTick - this.tick + flight;
      return ticks > 1 && ticks <= horizon;
    });
    return incoming || windingUp;
  }
  private estimatedAttackDelay(u: Unit, target: Unit): number {
    // Stationary-target estimate shared by farming and incoming-missile decisions.
    const state = this.championState(u.id);
    const q = state?.garenQ;
    const windup =
      q && !q.consumed && this.tick < q.attackUntil
        ? garenQAttackTimingAtLevel(state!.level).windupTicks
        : Math.round(u.windupTicks / this.attackSpeedMultiplier(u, target));
    const flight = u.missileSpeed
      ? Math.ceil(Math.max(0, distance(u, target) - target.radius - 8) / (u.missileSpeed * DT))
      : 0;
    return Math.max(0, u.nextAttackTick - this.tick) + windup + flight;
  }
  private incomingAttacksClaimMinion(u: Unit, target: Unit): boolean {
    if (!isLaneMinionKind(target.kind) || !this.visible(target, u.team)) return false;
    const arrival = this.estimatedAttackDelay(u, target);
    let damage = 0;
    for (const p of this.projectiles) {
      if (p.type !== 'attack' || p.team !== u.team || p.target !== target.id || p.speed <= 0)
        continue;
      const source = this.unit(p.source);
      if (!source || (!isLaneMinionKind(source.kind) && source.kind !== 'turret')) continue;
      if (!this.projectileVisible(p, u.team)) continue;
      const travel = Math.max(0, distance(p, target) - target.radius - p.radius);
      if (travel > p.remaining || Math.ceil(travel / (p.speed * DT)) >= arrival) continue;
      const ratio =
        source.kind === 'turret' && source.structure
          ? this.battlefield.turretMinionHealthDamage?.[target.kind]?.[source.structure.role]
          : undefined;
      // Ignore bonus current-health damage, expiring shields and unlaunched attacks.
      // Underestimating allied damage avoids unnecessarily abandoning a possible last hit.
      damage += damageAfterResistance(
        ratio === undefined ? p.damage : target.maxHp * ratio,
        target.armor
      );
    }
    return damage >= target.hp + this.shieldAmount(target);
  }
  private lastHitTarget(u: Unit): Unit | undefined {
    if (this.tick < u.nextAttackTick) return;
    const state = this.championState(u.id)!;
    // Estimate only the first Ashe Q impact; later arrows may arrive too late.
    const base = u.damage * this.basicAttackDamageMultiplier(u);
    const garenQ = state.garenQ;
    const garenQRank =
      u.champion === 'garen' && garenQ && !garenQ.consumed && this.tick < garenQ.attackUntil
        ? garenQ.rank
        : undefined;
    const raw =
      (state.qUntil > this.tick ? asheFocusFlurry(state.spellRanks.q, base)[0].damage : base) +
      this.garenQBonusDamage(u, garenQRank);
    let best: Unit | undefined;
    let bestDistance = Infinity;
    for (const target of this.units) {
      if (!isLaneMinionKind(target.kind) || !this.validTarget(u, target)) continue;
      const d = distance(u, target) - target.radius;
      let damage = damageAfterResistance(raw, target.armor);
      if (
        u.champion === 'lux' &&
        target.illumination.some(
          (mark) =>
            mark.sourceId === u.id &&
            mark.endTick > this.tick + this.estimatedAttackDelay(u, target)
        )
      )
        damage += damageAfterResistance(this.illuminationDamage(u), target.magicResist);
      if (
        d > u.range ||
        target.hp + this.shieldAmount(target) > damage ||
        !this.safeAttackPosition(u, target) ||
        this.incomingAttacksClaimMinion(u, target)
      )
        continue;
      // Preserve valuable last hits; equal-value choices prefer shorter flight.
      if (
        !best ||
        (target.goldBounty ?? 0) > (best.goldBounty ?? 0) ||
        ((target.goldBounty ?? 0) === (best.goldBounty ?? 0) && d < bestDistance)
      ) {
        best = target;
        bestDistance = d;
      }
    }
    return best;
  }
  private threateningTower(u: Unit, point: Vec2, attackingChampion = false): Unit | undefined {
    return this.units.find((tower) => {
      if (
        tower.kind !== 'turret' ||
        tower.team === u.team ||
        !this.alive(tower) ||
        !this.visible(tower, u.team) ||
        distance(tower, point) > tower.range + u.radius + 100
      )
        return false;
      const targetingUs =
        (tower.order.type === 'attack' && tower.order.target === u.id) ||
        (tower.releaseTick !== null && tower.attackTarget === u.id);
      const cover = this.units.some(
        (ally) =>
          ally.team === u.team &&
          isLaneMinionKind(ally.kind) &&
          this.alive(ally) &&
          distance(tower, ally) <= tower.range + ally.radius &&
          this.visible(ally, u.team)
      );
      return targetingUs || attackingChampion || !cover;
    });
  }
  private safeAttackPosition(u: Unit, target: Unit): boolean {
    const away = direction(target, u);
    const approach =
      distance(u, target) <= u.range + target.radius
        ? u
        : {
            x: target.x + away.x * (u.range + target.radius),
            y: target.y + away.y * (u.range + target.radius),
          };
    return !this.threateningTower(u, approach, target.kind === 'champion');
  }
  private advanceChampionLane(u: Unit): void {
    // Rejoin the assigned route after combat, recall or respawn. Route points
    // are authored blue-to-red; opponents traverse the same route in reverse.
    const laneIndex =
      u.lane ??
      Math.max(
        0,
        this.battlefield.lanes.findIndex((lane) => lane.name === 'mid')
      );
    const lane = this.battlefield.lanes[laneIndex];
    if (!lane?.points.length) return;
    u.lane = laneIndex;
    const committed =
      u.order.type === 'move' &&
      lane.points[u.laneWaypoint] &&
      distance(u.order.point, lane.points[u.laneWaypoint]) <= 1;
    let nearest = committed ? u.laneWaypoint : 0;
    let bestDistance = Infinity;
    if (committed) bestDistance = distance(u, lane.points[nearest]);
    else {
      for (const [index, point] of lane.points.entries()) {
        const d = distance(u, point);
        if (d < bestDistance) {
          nearest = index;
          bestDistance = d;
        }
      }
    }
    const step = u.team === 'blue' ? 1 : -1;
    const next = nearest + step;
    const waypoint = bestDistance <= 150 && next >= 0 && next < lane.points.length ? next : nearest;
    u.laneWaypoint = waypoint;
    const point = lane.points[waypoint];
    if (distance(u, point) <= 3) {
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    } else if (u.order.type !== 'move' || distance(u.order.point, point) > 1) {
      this.setOrder(u, { type: 'move', point: { ...point } });
    }
  }
  private safeToRecall(u: Unit): boolean {
    if (u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    // Tactical policy, not a native bot rule. Use team-visible threats only;
    // a hidden opponent's proximity must not influence a recall decision.
    const threatened =
      this.units.some(
        (enemy) =>
          enemy.team !== u.team &&
          enemy.kind !== 'dummy' &&
          this.alive(enemy) &&
          distance(u, enemy) <= (enemy.kind === 'champion' ? 1150 : enemy.range + u.radius + 400) &&
          this.visible(enemy, u.team)
      ) ||
      this.projectiles.some(
        (p) => p.team !== u.team && p.target === u.id && this.projectileVisible(p, u.team)
      );
    const recentlyHit = state.damageContributors.some(
      (entry) => this.tick - entry.lastDamageTick < 2 * TICK_RATE
    );
    return !threatened && !recentlyHit;
  }
  private planLaneScout(u: Unit): void {
    if (u.champion !== 'ashe') return;
    if (u.silenceUntil > this.tick) return;
    const state = this.championState(u.id)!;
    if (
      u.lane === null ||
      u.order.type !== 'move' ||
      state.spellRanks.e === 0 ||
      state.eCharges < ASHE_E.maximumCharges ||
      this.abilityCooldownTicks('e', u.id) > 0
    )
      return;
    const lane = this.battlefield.lanes[u.lane];
    const step = u.team === 'blue' ? 1 : -1;
    let aim: Vec2 | undefined;
    for (let index = u.laneWaypoint; index >= 0 && index < lane.points.length; index += step) {
      const point = lane.points[index];
      const d = distance(u, point);
      if (d > 1350 && d <= 4000 && !this.pointVisible(point, u.team)) aim = point;
    }
    // Scan the authored route, never hidden enemy coordinates. Keep one charge
    // available for future tactical scouting rather than emptying both on travel.
    if (aim) this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { ...aim } });
  }
  private nextBotPurchase(u: Unit) {
    const state = this.championState(u.id)!;
    if (state.role === 'jungle') {
      const id = !ownedCompanion(this, u.id)
        ? 'mosstomper'
        : !state.inventory.includes('boots')
          ? 'boots'
          : null;
      if (id) return ITEMS.find((item) => item.id === id);
    }
    if (u.champion === 'leona') {
      const upgrades: Readonly<Record<string, string>> = LEONA_BOT_POLICY.upgrades;
      const id =
        LEONA_BOT_POLICY.purchases.find(
          (item) =>
            !state.inventory.includes(item) &&
            !(upgrades[item] && state.inventory.includes(upgrades[item]))
        ) ?? Object.values(upgrades).find((item) => !state.inventory.includes(item));
      return ITEMS.find((item) => item.id === id);
    }
    if (u.champion === 'lux' || u.champion === 'ahri') {
      const policy = u.champion === 'ahri' ? AHRI_BOT_POLICY : LUX_BOT_POLICY;
      let id: string | undefined = policy.purchases.find(
        (id) =>
          !state.inventory.includes(id) && !(id === 'tome' && state.inventory.includes('chapter'))
      );
      if (!id && !state.inventory.includes('chapter')) {
        const plan = this.purchasePlan('chapter', u.id)!;
        id =
          state.gold >= plan.cost
            ? 'chapter'
            : (['sapphire', 'mote'].find((component) => !state.inventory.includes(component)) ??
              'chapter');
      }
      if (!id && !state.inventory.includes('deathcap')) {
        const plan = this.purchasePlan('deathcap', u.id)!;
        id =
          state.gold >= plan.cost || state.inventory.filter((item) => item === 'rod').length >= 2
            ? 'deathcap'
            : 'rod';
      }
      if (!id && !state.inventory.includes('wand')) id = 'wand';
      return ITEMS.find((item) => item.id === id);
    }
    let id = (state.role === 'jungle' ? ['boots'] : ['blade', 'boots']).find(
      (id) => !state.inventory.includes(id)
    );
    if (!id && !state.inventory.includes('infinity-edge')) {
      const plan = this.purchasePlan('infinity-edge', u.id)!;
      if (state.gold >= plan.cost) id = 'infinity-edge';
      else {
        // Prefer the largest affordable missing component. Returning the cheapest
        // missing component when none is affordable also informs recall planning.
        const missing = ITEM_RECIPES['infinity-edge']
          .filter((component) => !state.inventory.includes(component))
          .map((component) => ITEMS.find((item) => item.id === component)!)
          .sort((a, b) => b.price - a.price);
        id =
          missing.find((item) => item.price <= state.gold)?.id ??
          missing.at(-1)?.id ??
          'infinity-edge';
      }
    }
    return ITEMS.find((item) => item.id === id);
  }

  private masterYiSustainThreatened(u: Unit): boolean {
    if (u.kind !== 'champion') return true;
    return (
      !!this.threateningTower(u, u, true) ||
      this.units.some(
        (enemy) =>
          enemy.team !== u.team &&
          enemy.kind !== 'dummy' &&
          enemy.kind !== 'ward' &&
          !isStructureKind(enemy.kind) &&
          this.visible(enemy, u.team) &&
          this.alive(enemy) &&
          !(enemy.kind === 'monster' && enemy.monster.phase === 'returning') &&
          distance(u, enemy) <= MASTER_YI_BOT_POLICY.sustainThreatRange
      ) ||
      this.projectiles.some(
        (p) =>
          p.team !== u.team &&
          this.projectileVisible(p, u.team) &&
          (p.target === u.id || distance(u, p) <= MASTER_YI_BOT_POLICY.sustainThreatRange)
      )
    );
  }
  private planMasterYiMeditateSafety(u: Unit): void {
    if (u.kind !== 'champion' || !u.ai) return;
    const channel = this.championState(u.id)?.meditate;
    if (!channel || channel.stopTick !== null || this.tick < u.nextThink) return;
    u.nextThink = this.tick + 18;
    const unsafe = u.rootUntil <= this.tick && this.masterYiSustainThreatened(u);
    const healed = u.hp >= u.maxHp * MASTER_YI_BOT_POLICY.sustainStopHealthFraction;
    if (!unsafe && !healed) return;
    // Normal queued orders own interruption and its saved presentation tails.
    this.enqueue({
      type: 'order',
      unit: u.id,
      order: unsafe
        ? { type: 'move', point: { ...this.battlefield.spawns[u.team] } }
        : { type: 'idle' },
    });
  }
  private planMasterYiSustain(u: Unit): boolean {
    if (
      u.kind !== 'champion' ||
      u.champion !== 'masteryi' ||
      u.silenceUntil > this.tick ||
      u.releaseTick !== null ||
      u.hp >= u.maxHp * MASTER_YI_BOT_POLICY.sustainHealthFraction ||
      distance(u, this.battlefield.spawns[u.team]) <= 400
    )
      return false;
    const state = this.championState(u.id)!;
    if (
      state.pendingCast ||
      state.recallEnd !== null ||
      state.alphaStrike ||
      state.meditate ||
      !state.spellRanks.w ||
      this.abilityCooldownTicks('w', u.id) > 0 ||
      this.masterYiSustainThreatened(u) ||
      state.damageContributors.some((entry) => this.tick - entry.lastDamageTick < 2 * TICK_RATE)
    )
      return false;
    const reserve = state.spellRanks.q ? this.abilityResources('q', u.id).mana : 0;
    const cost = Math.ceil(
      this.abilityResources('w', u.id).mana +
        u.maxMana * MASTER_YI_W.maximumManaPerSecond * MASTER_YI_W.durationSeconds +
        reserve
    );
    if (u.mana < cost + this.queuedCastMana(u)) return false;
    this.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: { x: u.x, y: u.y } });
    return true;
  }
  private planMasterYiEscape(u: Unit): void {
    if (
      u.kind !== 'champion' ||
      u.champion !== 'masteryi' ||
      u.silenceUntil > this.tick ||
      u.rootUntil > this.tick
    )
      return;
    const state = this.championState(u.id)!;
    if (
      state.pendingCast ||
      state.recallEnd !== null ||
      state.alphaStrike ||
      state.meditate ||
      !state.spellRanks.r ||
      activeHighlander(state, this.tick) ||
      this.abilityCooldownTicks('r', u.id) > 0 ||
      u.mana < this.abilityResources('r', u.id).mana + this.queuedCastMana(u) ||
      distance(u, this.battlefield.spawns[u.team]) <= 400
    )
      return;
    if (
      !this.units.some(
        (enemy) =>
          enemy.kind === 'champion' &&
          enemy.team !== u.team &&
          this.visible(enemy, u.team) &&
          this.alive(enemy) &&
          this.targetable(enemy) &&
          distance(u, enemy) <= MASTER_YI_BOT_POLICY.highlanderRange
      )
    )
      return;
    this.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: u.x, y: u.y } });
  }
  private planMasterYiCombat(u: Unit): boolean {
    if (u.kind !== 'champion' || u.champion !== 'masteryi' || u.silenceUntil > this.tick)
      return false;
    const state = this.championState(u.id)!;
    if (
      state.pendingCast ||
      state.recallEnd !== null ||
      state.alphaStrike ||
      state.meditate ||
      u.releaseTick !== null ||
      this.threateningTower(u, u, true)
    )
      return false;
    const observed = this.units
      .filter(
        (target) =>
          target.kind === 'champion' &&
          target.team !== u.team &&
          this.visible(target, u.team) &&
          alphaTarget(this, u, target) &&
          distance(u, target) <= MASTER_YI_BOT_POLICY.highlanderRange &&
          !this.threateningTower(u, target, true)
      )
      .sort((a, b) => distance(u, a) - distance(u, b) || a.id - b.id)[0];
    // Jungle travel/selection stays with the existing observed camp planner.
    // Only its current attack order can offer a monster to this spell policy.
    const ordered = u.order.type === 'attack' ? this.unit(u.order.target) : undefined;
    const target =
      observed ??
      (state.role === 'jungle' &&
      ordered?.kind === 'monster' &&
      this.visible(ordered, u.team) &&
      alphaTarget(this, u, ordered) &&
      distance(u, ordered) <= MASTER_YI_Q.castRange
        ? ordered
        : undefined);
    if (!target) return false;
    const ready = (ability: 'q' | 'e' | 'r') =>
      state.spellRanks[ability] > 0 &&
      this.abilityCooldownTicks(ability, u.id) === 0 &&
      u.mana >= this.abilityResources(ability, u.id).mana + this.queuedCastMana(u);
    const alpha =
      u.rootUntil <= this.tick && distance(u, target) <= MASTER_YI_Q.castRange && ready('q');
    const highlander =
      target.kind === 'champion' &&
      !activeHighlander(state, this.tick) &&
      ready('r') &&
      (u.rootUntil <= this.tick || distance(u, target) <= u.range + target.radius) &&
      u.mana >=
        this.abilityResources('r', u.id).mana +
          this.queuedCastMana(u) +
          (state.spellRanks.q && this.abilityCooldownTicks('q', u.id) === 0
            ? this.abilityResources('q', u.id).mana
            : 0);
    const wuju =
      !state.wujuStyle && ready('e') && (alpha || distance(u, target) <= u.range + target.radius);
    if (!alpha && !wuju && !highlander) return false;
    if (alpha) this.setOrder(u, { type: 'idle' });
    else if (u.order.type !== 'attack' || u.order.target !== target.id)
      this.setOrder(u, { type: 'attack', target: target.id });
    if (highlander)
      this.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: u.x, y: u.y } });
    // E precedes Q through ordinary independent command validation. Q's
    // existing controller owns marks, repeats, on-hits and visibility changes.
    if (wuju) this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: u.x, y: u.y } });
    if (alpha)
      this.enqueue({
        type: 'cast',
        unit: u.id,
        ability: 'q',
        targetId: target.id,
        point: { x: target.x, y: target.y },
      });
    return true;
  }
  private planAhriCombat(u: Unit, retreating: boolean): boolean {
    if (u.kind !== 'champion' || u.champion !== 'ahri' || u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    if (state.pendingCast || state.recallEnd !== null || u.releaseTick !== null) return false;
    if (!retreating && this.threateningTower(u, u, true)) return false;
    const ready = (ability: 'q' | 'w' | 'e' | 'r') =>
      state.spellRanks[ability] > 0 &&
      this.abilityCooldownTicks(ability, u.id) === 0 &&
      u.mana >= this.abilityResources(ability, u.id).mana + this.queuedCastMana(u);
    // Read team sight before enemy health, position, targetability or movement.
    const enemies = this.units
      .filter(
        (target) =>
          target.kind === 'champion' &&
          target.team !== u.team &&
          this.visible(target, u.team) &&
          this.alive(target) &&
          this.targetable(target)
      )
      .sort((a, b) => distance(u, a) - distance(u, b) || a.id - b.id);
    const target = enemies.find(
      (enemy) =>
        distance(u, enemy) <=
        (retreating ? AHRI_BOT_POLICY.peelRange : AHRI_Q_POLICY.outwardDistance)
    );
    if (!target) return false;
    const cast = (ability: 'q' | 'w' | 'e', point = target) => {
      this.enqueue({
        type: 'cast',
        unit: u.id,
        ability,
        point: { x: point.x, y: point.y },
      });
      return true;
    };
    if (ready('e') && distance(u, target) <= AHRI_E_POLICY.range) {
      const dir = direction(u, target),
        end = { x: u.x + dir.x * AHRI_E_POLICY.range, y: u.y + dir.y * AHRI_E_POLICY.range };
      const first = this.units
        .flatMap((other) => {
          if (
            other.team === u.team ||
            !this.visible(other, u.team) ||
            !this.alive(other) ||
            !this.targetable(other) ||
            isStructureKind(other.kind) ||
            other.kind === 'ward' ||
            (other.kind === 'monster' && other.monster.phase === 'returning')
          )
            return [];
          const t = sweepCircle(u, end, other, AHRI_E_POLICY.radius + other.radius);
          return t === null ? [] : [{ id: other.id, t }];
        })
        .sort((a, b) => a.t - b.t || a.id - b.id)[0];
      if (first?.id === target.id) return cast('e');
    }
    if (retreating && ready('r') && this.planAhriEscape(u, enemies)) return true;
    // Use the ordinary acquisition radius conservatively from the caster's
    // center. The controller still chooses each fire's visible target at launch.
    if (
      ready('w') &&
      distance(u, target) <= AHRI_W.acquisitionRange &&
      !this.ahriFoxFires.some(
        (fire) =>
          fire.sourceId === u.id &&
          fire.stopTick === null &&
          fire.fires.some((shot) => shot.phase === 'orbit')
      )
    ) {
      if (retreating)
        this.setOrder(u, { type: 'move', point: { ...this.battlefield.spawns[u.team] } });
      return cast('w', u);
    }
    // Q pierces lane units. Aim at the observed position, without promising a
    // second-leg hit or tracking the target through fog after the command.
    if (!retreating && ready('q')) return cast('q');
    return false;
  }
  private planAhriEscape(u: Unit, observedEnemies: Unit[]): boolean {
    if (u.kind !== 'champion') return false;
    const home = this.battlefield.spawns[u.team];
    if (u.rootUntil > this.tick || distance(u, home) <= 400) return false;
    const threats = observedEnemies.filter((enemy) => distance(u, enemy) <= 1150);
    if (!threats.length || distance(u, threats[0]) > AHRI_BOT_POLICY.peelRange) return false;
    let away = direction(threats[0], u);
    if (!away.x && !away.y) away = direction(u, home);
    const directions = [
      away,
      direction(u, home),
      { x: (away.x - away.y) / Math.SQRT2, y: (away.x + away.y) / Math.SQRT2 },
      { x: (away.x + away.y) / Math.SQRT2, y: (away.y - away.x) / Math.SQRT2 },
      { x: -away.y, y: away.x },
      { x: away.y, y: -away.x },
    ];
    const currentClearance = distance(u, threats[0]);
    let aim: Vec2 | undefined;
    let bestScore = -Infinity;
    for (const dir of directions) {
      const point = {
        x: u.x + dir.x * AHRI_R.dashDistance,
        y: u.y + dir.y * AHRI_R.dashDistance,
      };
      const landing = spiritRushDestination(this, u, point);
      if (!landing || distance(u, landing) < AHRI_BOT_POLICY.escapeMinimumTravel) continue;
      const clearance = Math.min(...threats.map((enemy) => distance(landing, enemy)));
      if (
        clearance < currentClearance + AHRI_BOT_POLICY.escapeClearanceGain ||
        this.threateningTower(u, landing, true)
      )
        continue;
      const score = clearance - distance(landing, home) * 0.1;
      if (score > bestScore) {
        aim = point;
        bestScore = score;
      }
    }
    if (!aim) return false;
    // Keep the evaluated origin until normal next-tick cast validation.
    if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    this.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: aim });
    return true;
  }
  private planLuxCombat(u: Unit, retreating: boolean): boolean {
    if (u.champion !== 'lux' || u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    if (state.pendingCast || state.recallEnd !== null) return false;
    const ready = (ability: 'q' | 'w' | 'e' | 'r') =>
      state.spellRanks[ability] > 0 &&
      this.abilityCooldownTicks(ability, u.id) === 0 &&
      u.mana >= this.abilityResources(ability, u.id).mana;
    const cast = (ability: 'q' | 'w' | 'e' | 'r', point: Vec2) => {
      this.enqueue({ type: 'cast', unit: u.id, ability, point: { x: point.x, y: point.y } });
      return true;
    };
    // Filter sight before consulting enemy position, health or order.
    const enemies = this.units
      .filter(
        (target) =>
          target.kind === 'champion' &&
          target.team !== u.team &&
          this.alive(target) &&
          this.visible(target, u.team) &&
          this.targetable(target)
      )
      .sort((a, b) => distance(u, a) - distance(u, b) || a.id - b.id);
    const zone = this.singularities.find((z) => z.sourceId === u.id && z.detonatedTick === null);
    if (
      zone &&
      zone.arrivalTick !== null &&
      enemies.some((target) => distance(zone, target) <= LUX_E_POLICY.radius + target.radius)
    )
      return cast('e', zone);
    if (ready('w')) {
      const amount =
        LUX_W.baseShield[state.spellRanks.w - 1] + LUX_W.abilityPowerRatio * this.abilityPower(u);
      const ally = this.units
        .filter(
          (a) =>
            a.kind === 'champion' &&
            a.team === u.team &&
            this.alive(a) &&
            a.hp / a.maxHp < LUX_BOT_POLICY.shieldHealthFraction &&
            distance(u, a) <= LUX_W.range &&
            this.shieldAmount(a) < amount / 2 &&
            (enemies.some((enemy) => distance(enemy, a) <= 1000) ||
              this.projectiles.some(
                (p) => p.team !== u.team && p.target === a.id && this.projectileVisible(p, u.team)
              ))
        )
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
      if (ally) {
        // A self shield still needs a nonzero throw direction.
        const point =
          ally.id === u.id
            ? (enemies[0] ?? { x: u.x + Math.sin(u.facing), y: u.y + Math.cos(u.facing) })
            : ally;
        return cast('w', point);
      }
    }
    if (!retreating && this.threateningTower(u, u, true)) return false;
    if (!retreating && ready('r')) {
      const raw =
        LUX_R.baseDamage[state.spellRanks.r - 1] + LUX_R.abilityPowerRatio * this.abilityPower(u);
      const target = enemies.find(
        (enemy) =>
          distance(u, enemy) <= LUX_R.range &&
          enemy.hp + this.shieldAmount(enemy) <= this.mitigatedDamage(enemy, raw, 'magic')
      );
      if (target) return cast('r', target);
    }
    const target = enemies.find(
      (enemy) => distance(u, enemy) <= (retreating ? 700 : LUX_BINDING.range)
    );
    if (!target) return false;
    if (ready('q')) {
      const dir = direction(u, target),
        end = { x: u.x + dir.x * LUX_BINDING.range, y: u.y + dir.y * LUX_BINDING.range };
      const contacts = this.units
        .flatMap((enemy) => {
          if (
            enemy.team === u.team ||
            !this.alive(enemy) ||
            !this.visible(enemy, u.team) ||
            isStructureKind(enemy.kind)
          )
            return [];
          const t = sweepCircle(u, end, enemy, LUX_BINDING.radius + enemy.radius);
          return t === null ? [] : [{ id: enemy.id, t }];
        })
        .sort((a, b) => a.t - b.t || a.id - b.id)
        .slice(0, LUX_BINDING.maximumTargets);
      if (contacts.some((hit) => hit.id === target.id)) return cast('q', target);
    }
    if (!zone && ready('e') && distance(u, target) <= LUX_E.castRange) return cast('e', target);
    return false;
  }
  private planAhriWaveClear(u: Unit): boolean {
    if (u.kind !== 'champion' || u.champion !== 'ahri' || u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    if (
      state.pendingCast ||
      state.recallEnd !== null ||
      u.releaseTick !== null ||
      !state.spellRanks.q ||
      this.abilityCooldownTicks('q', u.id) > 0 ||
      this.threateningTower(u, u, true)
    )
      return false;
    const carry = this.supportCarry(u);
    const cost = this.abilityResources('q', u.id).mana;
    const point = ahriWaveClear({
      actor: { x: u.x, y: u.y },
      minions: this.units
        .filter(
          (m) =>
            isLaneMinionKind(m.kind) &&
            m.team !== u.team &&
            this.visible(m, u.team) &&
            this.alive(m) &&
            this.targetable(m)
        )
        .map((m) => ({
          id: m.id,
          x: m.x,
          y: m.y,
          radius: m.radius,
          hp: m.hp,
          magicResist: m.magicResist,
          shield: this.shieldAmount(m),
          claimed: this.incomingAttacksClaimMinion(u, m),
        })),
      damage: ahriOrbDamage(state.spellRanks.q, this.abilityPower(u)),
      mana: u.mana - this.queuedCastMana(u),
      manaCost: cost,
      reserve: Math.max(
        u.maxMana * AHRI_BOT_POLICY.waveClear.manaReserveFraction,
        (['w', 'e'] as const).reduce(
          (sum, a) => sum + (state.spellRanks[a] > 0 ? this.abilityResources(a, u.id).mana : 0),
          0
        )
      ),
      farmAllowed:
        state.role !== 'jungle' &&
        !(carry && distance(u, carry) <= JUNGLE_BOT_POLICY.supportFarmRadius),
      lastHitReady: !!this.lastHitTarget(u),
    });
    if (!point) return false;
    // Preserve the evaluated origin, using the same paid controller as human Q.
    if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    this.enqueue({ type: 'cast', unit: u.id, ability: 'q', point });
    return true;
  }
  private planLuxWaveClear(u: Unit): boolean {
    if (u.champion !== 'lux' || u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    if (state.recallEnd !== null || this.threateningTower(u, u)) return false;
    const zone = this.singularities.find((z) => z.sourceId === u.id && z.detonatedTick === null);
    if (
      zone
        ? zone.arrivalTick === null || zone.detonateRequested
        : state.pendingCast ||
          state.spellRanks.e === 0 ||
          this.abilityCooldownTicks('e', u.id) > 0 ||
          u.mana < this.abilityResources('e', u.id).mana
    )
      return false;
    const carry = this.supportCarry(u);
    const bases = this.units.filter(
      (s) => s.team === u.team && (s.kind === 'nexus' || s.kind === 'inhibitor') && this.alive(s)
    );
    const point = luxWaveClear({
      actor: { x: u.x, y: u.y },
      // Sight is checked before reading an opponent's position/health for policy.
      minions: this.units
        .filter(
          (m) =>
            isLaneMinionKind(m.kind) &&
            m.team !== u.team &&
            this.visible(m, u.team) &&
            this.alive(m) &&
            this.targetable(m)
        )
        .map((m) => ({
          id: m.id,
          x: m.x,
          y: m.y,
          radius: m.radius,
          hp: m.hp,
          magicResist: m.magicResist,
          shield: this.shieldAmount(m),
          claimed: this.incomingAttacksClaimMinion(u, m),
          baseThreat: bases.some(
            (s) => distance(s, m) <= LUX_BOT_POLICY.waveClear.baseThreatRadius + m.radius
          ),
          super: m.kind === 'super',
        })),
      damage:
        zone?.damage ??
        LUX_E.baseDamage[state.spellRanks.e - 1] + LUX_E.abilityPowerRatio * this.abilityPower(u),
      mana: u.mana,
      manaCost: this.abilityResources('e', u.id).mana,
      reserve: Math.max(
        u.maxMana * LUX_BOT_POLICY.waveClear.manaReserveFraction,
        (['q', 'w'] as const).reduce(
          (sum, a) => sum + (state.spellRanks[a] > 0 ? this.abilityResources(a, u.id).mana : 0),
          0
        )
      ),
      farmAllowed:
        state.role !== 'jungle' &&
        !(carry && distance(u, carry) <= JUNGLE_BOT_POLICY.supportFarmRadius),
      lastHitReady: !zone && !!this.lastHitTarget(u),
      zone: zone
        ? {
            x: zone.x,
            y: zone.y,
            arrived: zone.arrivalTick !== null,
            requested: zone.detonateRequested,
          }
        : null,
    });
    if (!point) return false;
    if (
      this.threateningTower(u, u, true) &&
      this.units.some(
        (enemy) =>
          enemy.kind === 'champion' &&
          enemy.team !== u.team &&
          this.visible(enemy, u.team) &&
          this.alive(enemy) &&
          this.targetable(enemy) &&
          distance(enemy, point) <= LUX_E_POLICY.radius + enemy.radius
      )
    )
      return false;
    this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point });
    return true;
  }
  private planCrystalArrow(u: Unit, purpose: 'finish' | 'peel'): boolean {
    if (u.champion !== 'ashe' || u.silenceUntil > this.tick) return false;
    const state = this.championState(u.id)!;
    if (
      state.spellRanks.r === 0 ||
      this.abilityCooldownTicks('r', u.id) > 0 ||
      u.mana < this.abilityResources('r', u.id).mana ||
      this.threateningTower(u, u, true)
    )
      return false;
    const raw = this.crystalArrowDamage(u);
    let chosen: Unit | undefined;
    let closest = purpose === 'peel' ? 650 : 1150;
    for (const target of this.units) {
      if (target.kind !== 'champion' || !this.validTarget(u, target)) continue;
      const d = distance(u, target);
      if (d > closest) continue;
      if (purpose === 'finish') {
        if (target.hp + this.shieldAmount(target) > this.mitigatedDamage(target, raw, 'magic'))
          continue;
      } else {
        // React to visible attacks on this bot, not hidden orders or intent.
        const attacking = target.releaseTick !== null && target.attackTarget === u.id;
        const incoming = this.projectiles.some(
          (p) =>
            p.source === target.id &&
            p.target === u.id &&
            p.type === 'attack' &&
            this.projectileVisible(p, u.team)
        );
        if (target.stunUntil > this.tick || (!attacking && !incoming)) continue;
      }
      const hit = sweepCircle(u, target, target, CRYSTAL_ARROW_RADIUS + target.radius)!;
      const blocked = this.units.some((other) => {
        if (
          other.id === target.id ||
          other.team === u.team ||
          !this.alive(other) ||
          (other.kind !== 'champion' && other.kind !== 'dummy') ||
          !this.visible(other, u.team)
        )
          return false;
        const contact = sweepCircle(u, target, other, CRYSTAL_ARROW_RADIUS + other.radius);
        return contact !== null && contact <= hit;
      });
      if (!blocked) {
        chosen = target;
        closest = d;
      }
    }
    if (!chosen) return false;
    if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    this.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: chosen.x, y: chosen.y } });
    return true;
  }
  private planEmergencyFlash(u: Unit): boolean {
    const slot = this.summonerSlot('flash', u.id);
    if (!slot) return false;
    if (u.kind !== 'champion' || u.silenceUntil > this.tick) return false;
    const home = this.battlefield.spawns[u.team];
    if (
      u.rootUntil > this.tick ||
      u.hp >= u.maxHp * 0.12 ||
      distance(u, home) <= 400 ||
      this.abilityCooldownTicks(slot, u.id) > 0
    )
      return false;
    const threats = this.units.filter(
      (enemy) =>
        enemy.kind === 'champion' && this.validTarget(u, enemy) && distance(u, enemy) <= 1150
    );
    threats.sort((a, b) => distance(u, a) - distance(u, b));
    if (!threats.length || distance(u, threats[0]) > 350) return false;
    let away = direction(threats[0], u);
    if (away.x === 0 && away.y === 0) away = direction(u, home);
    const directions = [
      away,
      direction(u, home),
      { x: (away.x - away.y) / Math.SQRT2, y: (away.x + away.y) / Math.SQRT2 },
      { x: (away.x + away.y) / Math.SQRT2, y: (away.y - away.x) / Math.SQRT2 },
    ];
    const currentClearance = distance(u, threats[0]);
    let aim: Vec2 | undefined;
    let bestScore = -Infinity;
    for (const dir of directions) {
      const point = { x: u.x + dir.x * ABILITIES.d.range, y: u.y + dir.y * ABILITIES.d.range };
      const landing = this.battlefield.reachable(point, u.radius, u.team);
      const clearance = Math.min(...threats.map((enemy) => distance(landing, enemy)));
      if (
        distance(u, landing) < 200 ||
        clearance < currentClearance + 200 ||
        this.threateningTower(u, landing, true)
      )
        continue;
      const score = clearance - distance(landing, home) * 0.1;
      if (score > bestScore) {
        aim = point;
        bestScore = score;
      }
    }
    if (!aim) return false;
    // Hold the evaluated launch position until the normal command executes.
    if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    this.enqueue({ type: 'cast', unit: u.id, ability: slot, point: aim });
    return true;
  }
  private knownStructureDestroyedForPlans(u: Unit, team: Team): boolean {
    const death = this.knownStructureDeathTick(u, team);
    if (death === null) return false;
    const role = u.structure?.role;
    const delay =
      role === 'inhibitor' || role === 'nexus-turret' ? STRUCTURE_RESPAWN_TICKS[role] : null;
    // This is the public calendar derived from a known death. Never consult an
    // unseen structure's current health or actual respawn deadline here.
    return delay === null || this.tick < death + delay;
  }
  private knownTeamTowers(team: Team) {
    return this.units.filter(
      (t) =>
        t.kind === 'turret' &&
        t.team !== team &&
        (t.structureKnowledge
          ? !this.knownStructureDestroyedForPlans(t, team)
          : this.visible(t, team) && this.alive(t))
    );
  }
  private advanceTeamPlans(): void {
    if (!this.teamPlans) return;
    for (const team of ['blue', 'red'] as const) {
      const plan = this.teamPlans[team];
      if (this.tick < plan.nextThinkTick) continue;
      const seen = this.units.filter((u) => u.team !== team && this.visible(u, team));
      const enemies = seen
        .filter((u) => u.kind === 'champion' && this.alive(u))
        .map((u) => ({
          id: u.id,
          x: u.x,
          y: u.y,
          hp: u.hp,
          maxHp: u.maxHp,
          damage: u.damage,
          attackPeriod: u.attackPeriod,
        }));
      const structure = (u: Unit): SeenStructure => ({
        id: u.id,
        x: u.x,
        y: u.y,
        kind: u.kind as SeenStructure['kind'],
        hp: u.hp,
        maxHp: u.maxHp,
        range: u.range,
        attackable: this.targetable(u),
      });
      const observation: TeamObservation = {
        tick: this.tick,
        home: this.battlefield.spawns[team],
        actors: this.units
          .filter((u) => u.kind === 'champion' && u.team === team && this.alive(u))
          .map((u) => {
            const s = this.championState(u.id)!,
              target = u.order.type === 'attack' ? this.unit(u.order.target) : undefined;
            return {
              id: u.id,
              x: u.x,
              y: u.y,
              hp: u.hp,
              maxHp: u.maxHp,
              damage: u.damage,
              attackPeriod: u.attackPeriod,
              role: s.role,
              controlled: u.ai,
              available: !u.aiRetreating && s.recallEnd === null,
              level: s.level,
              companionComplete: companionStage(ownedCompanion(this, u.id)?.fed ?? 0) === 2,
              clearing:
                !!target &&
                target.kind === 'monster' &&
                target.monster.species !== 'scuttler' &&
                this.visible(target, team) &&
                this.alive(target),
            };
          }),
        minions: this.units
          .filter((u) => u.team === team && isLaneMinionKind(u.kind) && this.alive(u))
          .map((u) => {
            const lane = u.lane === null ? null : this.battlefield.lanes[u.lane]?.name;
            return {
              x: u.x,
              y: u.y,
              lane: lane === 'top' || lane === 'mid' || lane === 'bot' ? lane : null,
            };
          }),
        enemies,
        enemyMinions: seen
          .filter((u) => isLaneMinionKind(u.kind) && this.alive(u))
          .map((u) => ({ x: u.x, y: u.y })),
        ownStructures: this.units
          .filter((u) => u.team === team && !!u.structure && this.alive(u))
          .map(structure),
        enemyStructures: seen.filter((u) => !!u.structure && this.alive(u)).map(structure),
        knownStructures: this.units
          .filter((u) => u.team !== team && !!u.structure)
          .map((u) => ({
            id: u.id,
            x: u.x,
            y: u.y,
            kind: u.kind as SeenStructure['kind'],
            role: u.structure!.role,
            lane: u.structure!.lane,
            knownDestroyed: this.knownStructureDestroyedForPlans(u, team),
          })),
        scuttlers: seen
          .filter((u) => u.kind === 'monster' && u.monster.species === 'scuttler' && this.alive(u))
          .map((u) => ({
            id: u.id,
            x: u.x,
            y: u.y,
            hp: u.hp,
            maxHp: u.maxHp,
            attackable: this.targetable(u),
          })),
        towers: this.knownTeamTowers(team).map((t) => ({ x: t.x, y: t.y, range: t.range })),
        gone: new Set(seen.filter((u) => !this.alive(u)).map((u) => u.id)),
      };
      plan.assignments = planTeam(plan.assignments, observation);
      plan.nextThinkTick = this.tick + BOT_TEAM_POLICY.thinkTicks;
    }
  }
  private teamGoal(u: Unit): TeamGoal | undefined {
    if (u.kind !== 'champion') return;
    return this.teamPlans?.[u.team].assignments.find(
      (g) => g.unitId === u.id && g.expiresTick > this.tick
    );
  }
  private followTeamGoal(u: Unit, goal: TeamGoal): boolean {
    if (u.kind !== 'champion') return false;
    const point = this.battlefield.reachable(goal.point, u.radius, u.team);
    // Never use a hidden tower's actual health to remove a remembered hazard.
    const path =
      u.order.type === 'move' && distance(u.order.point, point) < 50 && u.path.length
        ? u.path
        : this.battlefield.findPath(u, point, u.radius, u.team);
    if (!path.length && distance(u, point) > 200) return false;
    const route = [u, ...path, point];
    const unsafe = this.knownTeamTowers(u.team).some((t) => {
      const cover =
        goal.kind !== 'gank' &&
        this.units.some(
          (m) =>
            m.team === u.team &&
            isLaneMinionKind(m.kind) &&
            this.alive(m) &&
            distance(m, t) <= t.range + m.radius
        );
      return (
        !cover &&
        route.some(
          (b, i) =>
            i > 0 &&
            segmentDistance(t, route[i - 1], b) < t.range + u.radius + BOT_TEAM_POLICY.towerMargin
        )
      );
    });
    if (unsafe) return false;
    if (distance(u, point) <= 200) {
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      return true;
    }
    if (u.order.type !== 'move' || distance(u.order.point, point) > 50)
      this.setOrder(u, { type: 'move', point: { x: point.x, y: point.y } });
    return true;
  }
  private junglePlan(u: Unit) {
    if (u.kind !== 'champion') return null;
    const state = this.championState(u.id)!;
    if (!state.jungle) return null;
    const monsters = this.units.filter(
      (other) => other.kind === 'monster' && this.alive(other) && this.visible(other, u.team)
    );
    const observed = monsters.flatMap((other) => {
      // Membership identifies an already observed actor; no hidden population,
      // health, split schedule or actual respawn deadline enters the planner.
      const camp = this.jungleCamps.find((c) => c.unitIds.includes(other.id));
      return camp
        ? [
            {
              id: other.id,
              camp: camp.id,
              x: other.x,
              y: other.y,
              targetable: this.targetable(other) && other.monster!.phase !== 'returning',
              lineOfSightToActor: this.battlefield.lineOfSight(other, u),
            },
          ]
        : [];
    });
    const visibleHomes = new Set<import('../content/rift-camps').RiftCampId>();
    const current = jungleRoute(u.team).find((c) => c.id === state.jungle!.camp);
    if (
      current &&
      current.members.every((_, slot) =>
        this.pointVisible(campMemberHome(current, slot, this.battlefield), u.team)
      )
    )
      visibleHomes.add(current.id as import('../content/rift-camps').RiftCampId);
    return jungleDecision(state.jungle, {
      tick: this.tick,
      team: u.team,
      actor: u,
      monsters: observed,
      visibleHomes,
    });
  }
  private supportCarry(u: Unit) {
    return this.championState(u.id)?.role === 'support'
      ? this.units.find(
          (ally) =>
            ally.team === u.team &&
            ally.kind === 'champion' &&
            this.alive(ally) &&
            this.championState(ally.id)?.role === 'carry'
        )
      : undefined;
  }
  /** Ordinary support attacks need an observable contact window too; the E/R
   * follow-up checks alone do not protect a melee pursuit of mobile opponents. */
  private leonaSupportAttackReady(u: Unit, target: Unit): boolean {
    if (
      u.champion !== 'leona' ||
      this.championState(u.id)?.role !== 'support' ||
      target.kind !== 'champion'
    )
      return true;
    if (!this.visible(target, u.team)) return false;
    const d = distance(u, target),
      reach = this.attackRange(u) + target.radius;
    if (d <= reach) return true;
    const away = direction(target, u);
    if (
      !this.battlefield.lineWalkable(
        u,
        { x: target.x + away.x * reach, y: target.y + away.y * reach },
        u.radius,
        u.team === 'neutral' ? undefined : u.team
      )
    )
      return false;
    const speed = this.movementSpeed(u);
    if (speed <= 0 || u.rootUntil > this.tick || u.stunUntil > this.tick) return false;
    const approach = Math.ceil((d - reach) / (speed * DT));
    if (
      Math.max(target.rootUntil, target.stunUntil) >=
      this.tick + 1 + approach + this.estimatedAttackDelay(u, target)
    )
      return true;
    if (approach > LEONA_BOT_POLICY.supportApproachTicks) return false;
    return this.units.some(
      (ally) =>
        ally.id !== u.id &&
        ally.kind === 'champion' &&
        ally.team === u.team &&
        this.alive(ally) &&
        this.visible(ally, u.team) &&
        ally.stunUntil <= this.tick &&
        !ally.aiRetreating &&
        distance(ally, target) <= this.attackRange(ally) + target.radius &&
        ((ally.order.type === 'attack' && ally.order.target === target.id) ||
          (ally.releaseTick !== null && ally.attackTarget === target.id))
    );
  }
  private stageLeonaSupport(u: Unit, carry: Unit | undefined): boolean {
    if (u.champion !== 'leona' || this.championState(u.id)?.role !== 'support' || !carry)
      return false;
    if (u.team === 'neutral') return false;
    const behind = direction(carry, this.battlefield.spawns[u.team]);
    const point = this.battlefield.reachable(
      {
        x: carry.x + behind.x * LEONA_BOT_POLICY.supportStagingDistance,
        y: carry.y + behind.y * LEONA_BOT_POLICY.supportStagingDistance,
      },
      u.radius,
      u.team
    );
    if (this.threateningTower(u, point, true)) return false;
    if (distance(u, point) <= 100) {
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    } else if (u.order.type !== 'move' || distance(u.order.point, point) > 100)
      this.setOrder(u, { type: 'move', point });
    return true;
  }
  private planRoleWard(u: Unit): boolean {
    if (u.kind !== 'champion') return false;
    const s = this.championState(u.id)!;
    if (
      s.role !== 'support' ||
      !this.battlefield.inBrush ||
      s.trinket.kind !== 'ward' ||
      !s.trinket.charges ||
      s.trinket.cooldownTick > this.tick ||
      distance(u, this.battlefield.spawns[u.team]) < 1800 ||
      this.nearest(u, 1000, true)
    )
      return false;
    const candidates = Array.from({ length: 16 }, (_, i) => ({
      x: u.x + Math.cos((i * Math.PI) / 8) * 450,
      y: u.y + Math.sin((i * Math.PI) / 8) * 450,
    })).filter(
      (point) =>
        this.battlefield.inBrush!(point) &&
        !this.units.some(
          (ward) =>
            ward.kind === 'ward' &&
            ward.team === u.team &&
            this.alive(ward) &&
            distance(ward, point) < 900
        )
    );
    candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    if (!candidates.length) return false;
    this.enqueue({ type: 'ward', unit: u.id, point: candidates[0] });
    return true;
  }
  private think(u: Unit): void {
    if (u.kind !== 'champion') return;
    if (u.hp < u.maxHp * 0.22) u.aiRetreating = true;
    if (u.aiRetreating && u.hp >= u.maxHp * 0.85) u.aiRetreating = false;
    if (u.aiRetreating) {
      const home = this.battlefield.spawns[u.team];
      const state = this.championState(u.id)!;
      this.planGarenQ(u, true);
      if (this.planAhriCombat(u, true) || this.planLuxCombat(u, true)) return;
      if (this.planEmergencyFlash(u)) return;
      this.planMasterYiEscape(u);
      if (distance(u, home) > 400 && this.planCrystalArrow(u, 'peel')) return;
      if (this.safeToRecall(u)) {
        if (state.recallEnd !== null) return;
        // Walking is preferable when already closer than one recall's travel.
        if (distance(u, home) > (u.speed * RECALL_DURATION_TICKS) / TICK_RATE) {
          this.enqueue({ type: 'recall', unit: u.id });
          return;
        }
      }
      if (distance(u, home) < 100) {
        if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      } else if (u.order.type !== 'move' || distance(u.order.point, home) > 1)
        this.setOrder(u, { type: 'move', point: home });
      return;
    }
    if (distance(u, this.battlefield.spawns[u.team]) <= 400) {
      const next = this.nextBotPurchase(u);
      if (next) this.buy(next.id, u.id);
    }
    const tower = this.threateningTower(
      u,
      u,
      u.releaseTick !== null && this.unit(u.attackTarget ?? -1)?.kind === 'champion'
    );
    if (tower) {
      let away = direction(tower, u);
      if (away.x === 0 && away.y === 0) away = direction(tower, this.battlefield.spawns[u.team]);
      const clearance = tower.range + u.radius + 200;
      const point = { x: tower.x + away.x * clearance, y: tower.y + away.y * clearance };
      if (u.order.type !== 'move' || distance(u.order.point, point) > 25)
        this.setOrder(u, { type: 'move', point });
      return;
    }
    // Keep a valid committed windup; retargeting through setOrder would cancel it.
    if (u.releaseTick !== null && this.validTarget(u, this.unit(u.attackTarget ?? -1))) return;
    if (this.planMasterYiSustain(u)) return;
    const observedChampions = this.units.filter(
      (other) =>
        other.id !== u.id &&
        other.kind === 'champion' &&
        this.alive(other) &&
        this.visible(other, u.team)
    );
    const disengage = botDisengagePoint(
      u,
      observedChampions.filter((other) => other.team === u.team),
      observedChampions.filter((other) => other.team !== u.team),
      this.battlefield.spawns[u.team],
      (point) =>
        this.battlefield.lineWalkable(u, point, u.radius, u.team) &&
        !this.threateningTower(u, point, true)
    );
    if (disengage) {
      this.planGarenQ(u, true);
      this.planMasterYiEscape(u);
      if (
        this.planAhriCombat(u, true) ||
        this.planLuxCombat(u, true) ||
        this.planCrystalArrow(u, 'peel')
      )
        return;
      if (u.order.type !== 'move' || distance(u.order.point, disengage) > 50)
        this.setOrder(u, { type: 'move', point: disengage });
      return;
    }
    const state = this.championState(u.id)!;
    const nextPurchase = this.nextBotPurchase(u);
    const nextPlan = nextPurchase ? this.purchasePlan(nextPurchase.id, u.id) : null;
    const canShop =
      nextPlan &&
      state.gold >= Math.max(900, nextPlan.cost) &&
      (state.inventory.length < 6 ||
        state.inventory.includes(null) ||
        nextPlan.consumed.length > 0);
    if (state.recallEnd !== null || canShop) {
      const safe = this.safeToRecall(u);
      if (state.recallEnd !== null) {
        if (safe) return;
        this.setOrder(u, { type: 'idle' });
      } else if (
        safe &&
        distance(u, this.battlefield.spawns[u.team]) > (u.speed * RECALL_DURATION_TICKS) / TICK_RATE
      ) {
        this.enqueue({ type: 'recall', unit: u.id });
        return;
      }
    }
    const goal = this.teamGoal(u);
    if (
      goal?.kind === 'defend' &&
      distance(u, goal.point) > 1000 &&
      !this.nearest(u, 650, true) &&
      this.followTeamGoal(u, goal)
    )
      return;
    if (this.planRoleWard(u)) return;
    if (this.planLeonaE(u)) return;
    if (this.planLeonaR(u)) return;
    if (this.planLeonaSupportedE(u)) return;
    if (this.planCrystalArrow(u, 'finish')) return;
    if (this.planGarenR(u)) return;
    if (this.planGarenE(u)) return;
    if (this.planMasterYiCombat(u)) return;
    if (this.planAhriCombat(u, false) || this.planLuxCombat(u, false)) return;
    if (this.planAhriWaveClear(u) || this.planLuxWaveClear(u)) return;
    this.planGarenQ(u, false);
    const carry = this.supportCarry(u);
    const leaveFarm = !!carry && distance(u, carry) <= JUNGLE_BOT_POLICY.supportFarmRadius;
    const safeTarget = (target: Unit) =>
      !(
        state.role === 'jungle' &&
        target.kind !== 'champion' &&
        !(goal?.kind === 'defend' && isLaneMinionKind(target.kind))
      ) &&
      !(leaveFarm && isLaneMinionKind(target.kind)) &&
      this.safeAttackPosition(u, target) &&
      this.leonaSupportAttackReady(u, target) &&
      !this.incomingAttacksClaimMinion(u, target);
    const jungle = goal ? null : this.junglePlan(u);
    const plannedTarget = goal && goal.kind !== 'defend' ? this.unit(goal.targetId) : undefined;
    const goalTarget =
      plannedTarget &&
      this.visible(plannedTarget, u.team) &&
      distance(u, plannedTarget) <= 1150 &&
      (plannedTarget.kind === 'monster'
        ? goal?.kind === 'river' &&
          plannedTarget.monster.species === 'scuttler' &&
          plannedTarget.monster.phase !== 'returning' &&
          this.alive(plannedTarget) &&
          this.targetable(plannedTarget)
        : this.validTarget(u, plannedTarget)) &&
      this.safeAttackPosition(u, plannedTarget) &&
      this.leonaSupportAttackReady(u, plannedTarget)
        ? plannedTarget
        : undefined;
    const jungleTarget = jungle?.type === 'attack' ? this.unit(jungle.target) : undefined;
    const nearest = this.nearest(u, 1150, false, safeTarget);
    const closeThreat = this.nearest(u, 380, true, safeTarget);
    // An immediate champion threat keeps priority over farming.
    const target =
      closeThreat && distance(u, closeThreat) < 380
        ? closeThreat
        : (goalTarget ??
          jungleTarget ??
          (leaveFarm || state.role === 'jungle' ? undefined : this.lastHitTarget(u)) ??
          nearest);
    if (target) {
      const d = distance(u, target);
      const state = this.championState(u.id)!;
      // Reset recovery after an ordinary melee hit, keeping committed windups
      // above intact. Use only the already observed, safely selected champion.
      // An earlier defensive W command keeps its mana priority at dispatch.
      if (
        u.champion === 'leona' &&
        target.kind === 'champion' &&
        u.silenceUntil <= this.tick &&
        u.releaseTick === null &&
        this.tick < u.nextAttackTick &&
        !state.leonaQ &&
        state.spellRanks.q > 0 &&
        d <= this.attackRange(u) + target.radius &&
        this.abilityCooldownTicks('q', u.id) === 0 &&
        u.mana >= this.abilityResources('q', u.id).mana + this.queuedCastMana(u)
      ) {
        if (u.order.type !== 'attack' || u.order.target !== target.id)
          this.setOrder(u, { type: 'attack', target: target.id });
        this.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: { x: u.x, y: u.y } });
        return;
      }
      // Spend Focus against a visible champion during recovery, preserving a
      // committed windup above. The queued cast is validated next tick like input.
      if (
        u.champion === 'ashe' &&
        (target.kind === 'champion' || (state.role === 'jungle' && target.kind === 'monster')) &&
        u.silenceUntil <= this.tick &&
        d <= u.range + target.radius &&
        this.tick < u.nextAttackTick &&
        state.qStacks >= ASHE_Q.maxStacks &&
        state.qUntil <= this.tick &&
        state.spellRanks.q > 0 &&
        u.mana >= this.abilityResources('q', u.id).mana &&
        this.abilityCooldownTicks('q', u.id) === 0
      ) {
        if (u.order.type !== 'attack' || u.order.target !== target.id)
          this.setOrder(u, { type: 'attack', target: target.id });
        this.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: { x: u.x, y: u.y } });
        return;
      }
      const smite = this.summonerSlot('smite', u.id);
      if (
        state.role === 'jungle' &&
        target.kind === 'monster' &&
        smite &&
        state.smite?.charges &&
        this.abilityCooldownTicks(smite, u.id) === 0 &&
        smiteTarget(this, u, target) &&
        target.hp <=
          (ownedCompanion(this, u.id)
            ? companionSmiteDamage(ownedCompanion(this, u.id)!.fed)
            : SUMMONER_SMITE.baseDamage)
      ) {
        this.enqueue({
          type: 'cast',
          unit: u.id,
          ability: smite,
          point: { x: target.x, y: target.y },
          targetId: target.id,
        });
      }
      if (
        u.champion === 'ashe' &&
        state.role === 'jungle' &&
        target.kind === 'monster' &&
        this.tick < u.nextAttackTick &&
        u.silenceUntil <= this.tick &&
        state.spellRanks.w > 0 &&
        u.mana >= this.abilityResources('w', u.id).mana &&
        this.abilityCooldownTicks('w', u.id) === 0 &&
        this.units.filter(
          (m) =>
            m.kind === 'monster' &&
            this.alive(m) &&
            this.visible(m, u.team) &&
            distance(m, target) < 400
        ).length >= 2
      ) {
        this.enqueue({
          type: 'cast',
          unit: u.id,
          ability: 'w',
          point: { x: target.x, y: target.y },
        });
      }
      // Poke a visible champion beyond basic-attack range. Aim at the observed
      // position; queued point data must not track the target after sight is lost.
      if (
        u.champion === 'ashe' &&
        target.kind === 'champion' &&
        u.silenceUntil <= this.tick &&
        d > u.range + target.radius &&
        d <= ABILITIES.w.range &&
        state.spellRanks.w > 0 &&
        u.mana >= this.abilityResources('w', u.id).mana &&
        this.abilityCooldownTicks('w', u.id) === 0
      ) {
        if (u.order.type !== 'attack' || u.order.target !== target.id)
          this.setOrder(u, { type: 'attack', target: target.id });
        this.enqueue({
          type: 'cast',
          unit: u.id,
          ability: 'w',
          point: { x: target.x, y: target.y },
        });
        return;
      }
      if (
        u.missileSpeed > 0 &&
        d < 380 &&
        target.kind === 'champion' &&
        this.tick < u.nextAttackTick
      ) {
        let away = direction(target, u);
        if (away.x === 0 && away.y === 0) away = direction(u, this.battlefield.spawns[u.team]);
        this.setOrder(u, { type: 'move', point: { x: u.x + away.x * 180, y: u.y + away.y * 180 } });
      } else if (u.order.type !== 'attack' || u.order.target !== target.id)
        this.setOrder(u, { type: 'attack', target: target.id });
    } else if (this.nearest(u, 1150, state.role === 'jungle')) {
      // Visible opponents remain, but none offers a safe attack position.
      // Hold rather than resuming the lane route into their tower protection.
      if (this.stageLeonaSupport(u, carry)) return;
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    } else if (goal) {
      // Retain the captured team point; hidden targets never supply a new position.
      if (!this.followTeamGoal(u, goal)) {
        const fallback = this.junglePlan(u);
        if (fallback?.type === 'move')
          this.setOrder(u, { type: 'move', point: { ...fallback.point } });
        else if (fallback?.type === 'attack')
          this.setOrder(u, { type: 'attack', target: fallback.target });
        else if (!fallback && this.battlefield.id === 'rift') this.advanceChampionLane(u);
        else if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      }
    } else if (jungle) {
      if (jungle.type === 'move') {
        if (u.order.type !== 'move' || distance(u.order.point, jungle.point) > 1)
          this.setOrder(u, { type: 'move', point: { ...jungle.point } });
      } else if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    } else if (
      carry &&
      distance(carry, this.battlefield.spawns[u.team]) > 1200 &&
      distance(u, carry) > 450 &&
      !this.threateningTower(u, carry)
    ) {
      const behind = direction(carry, this.battlefield.spawns[u.team]);
      const point = { x: carry.x + behind.x * 250, y: carry.y + behind.y * 250 };
      if (u.order.type !== 'move' || distance(u.order.point, point) > 100)
        this.setOrder(u, { type: 'move', point });
    } else if (this.battlefield.id === 'rift') {
      this.advanceChampionLane(u);
      this.planLaneScout(u);
    } else if (u.order.type !== 'move')
      this.setOrder(u, {
        type: 'move',
        point: { x: 650, y: -490 },
      });
  }
  private planGarenQ(u: Unit, retreating: boolean): boolean {
    if (u.champion !== 'garen' || u.silenceUntil > this.tick || u.releaseTick !== null)
      return false;
    const state = this.championState(u.id)!;
    if (state.spellRanks.q === 0 || this.abilityCooldownTicks('q', u.id) > 0 || state.garenQ)
      return false;
    const target = this.nearest(u, 1000, true);
    if (!target) return false;
    const chaseRange =
      u.range +
      target.radius +
      u.speed * GAREN_Q.movementSecondsByRank[state.spellRanks.q - 1] * 0.5;
    if (!retreating && (distance(u, target) > chaseRange || !this.safeAttackPosition(u, target)))
      return false;
    this.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: { x: u.x, y: u.y } });
    return true;
  }
  private planGarenR(u: Unit): boolean {
    if (u.champion !== 'garen' || u.stunUntil > this.tick || u.silenceUntil > this.tick)
      return false;
    const state = this.championState(u.id)!;
    if (!state.spellRanks.r || state.pendingCast || this.abilityCooldownTicks('r', u.id) > 0)
      return false;
    const target = this.units
      .filter(
        (enemy) =>
          enemy.kind === 'champion' &&
          this.validTarget(u, enemy) &&
          distance(u, enemy) <= GAREN_R.castRange &&
          garenRDamage(state.spellRanks.r, enemy.hp, enemy.maxHp) >=
            enemy.hp + this.shieldAmount(enemy) &&
          !this.threateningTower(u, u, true)
      )
      .sort((a, b) => a.hp - b.hp || a.id - b.id)[0];
    if (!target) return false;
    this.enqueue({
      type: 'cast',
      unit: u.id,
      ability: 'r',
      point: { x: target.x, y: target.y },
      targetId: target.id,
    });
    return true;
  }
  private planGarenE(u: Unit): boolean {
    if (u.champion !== 'garen' || u.stunUntil > this.tick || u.silenceUntil > this.tick)
      return false;
    const state = this.championState(u.id)!;
    if (
      !state.spellRanks.e ||
      state.garenE ||
      state.pendingCast ||
      this.abilityCooldownTicks('e', u.id) > 0
    )
      return false;
    const targets = this.units.filter(
      (enemy) =>
        !isStructureKind(enemy.kind) &&
        enemy.kind !== 'dummy' &&
        this.validTarget(u, enemy) &&
        distance(u, enemy) <= GAREN_E.radius + enemy.radius &&
        this.safeAttackPosition(u, enemy)
    );
    if (!targets.some((enemy) => enemy.kind === 'champion') && targets.length < 3) return false;
    this.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: u.x, y: u.y } });
    return true;
  }
  private cancelGarenRVisual(state: ChampionState) {
    const effect = state.garenRVisual;
    if (effect && effect.releaseTick === null && effect.stopTick === null)
      effect.stopTick = this.tick;
  }

  private finishGarenE(state: ChampionState): void {
    if (!state.garenE) return;
    if (state.garenEVisual) state.garenEVisual.stopTick = this.tick;
    state.cooldowns.e = this.tick + state.garenE.cooldownTicks;
    state.garenE = null;
    const source = this.unit(state.id);
    if (source) this.setOrder(source, { type: 'idle' });
  }
  private finishGarenW(state: ChampionState, reason: 'expired' | 'death' | 'match-end'): void {
    if (!state.garenW) return;
    if (state.garenWVisual) {
      state.garenWVisual.stopTick = this.tick;
      state.garenWVisual.endReason = reason;
    }
    state.garenW = null;
  }
  private advanceGarenSpins(): void {
    for (const state of this.activeChampionStates()) {
      const spin = state.garenE;
      if (!spin) continue;
      const source = this.unit(state.id)!;
      if (!this.alive(source)) {
        this.finishGarenE(state);
        continue;
      }
      while (
        spin.completedStrikes < spin.strikes &&
        this.tick >= garenEStrikeTick(spin.startTick, spin.strikes, spin.completedStrikes + 1)
      ) {
        spin.completedStrikes++;
        const targets = this.units
          .filter(
            (target) =>
              target.team !== source.team &&
              this.alive(target) &&
              !isStructureKind(target.kind) &&
              target.kind !== 'ward' &&
              this.targetable(target) &&
              distance(source, target) <= GAREN_E.radius + target.radius
          )
          .sort((a, b) => distance(source, a) - distance(source, b) || a.id - b.id);
        // One roll per damaging spin, shared by its simultaneous recipients.
        const critical =
          targets.length > 0 &&
          this.criticalChance(source) > 0 &&
          this.random.next() < this.criticalChance(source);
        const criticalMultiplier = critical
          ? 1 +
            GAREN_E.bonusCriticalDamageRatio * (this.basicAttackDamageMultiplier(source, true) - 1)
          : 1;
        const raw =
          (GAREN_E.baseDamageByRank[spin.rank - 1] +
            GAREN_E.attackDamageRatioByRank[spin.rank - 1] * source.damage) *
          criticalMultiplier;
        for (const [index, target] of targets.entries()) {
          this.damage(
            source,
            target,
            raw * (index === 0 ? 1 + GAREN_E.nearestEnemyBonus : 1),
            'physical',
            'area'
          );
          this.emit('judgment-hit', target, {
            unit: target.id,
            champion: 'garen',
            team: source.team,
          });
          if (target.kind !== 'champion' || !this.alive(target)) continue;
          let hit = spin.hits.find((hit) => hit.targetId === target.id);
          if (!hit) {
            hit = { targetId: target.id, count: 0 };
            spin.hits.push(hit);
          }
          hit.count++;
          const shred = target.garenEShreds.find((shred) => shred.sourceId === source.id);
          if (hit.count >= GAREN_E.strikesToShred || shred) {
            const effect = {
              sourceId: source.id,
              startTick: this.tick,
              endTick: this.tick + Math.round(GAREN_E.shredSeconds * TICK_RATE),
            };
            if (shred) Object.assign(shred, effect);
            else target.garenEShreds.push(effect);
          }
        }
      }
      if (this.tick >= spin.endTick) this.finishGarenE(state);
    }
  }
  private garenQAttack(u: Unit) {
    if (u.attackCycle?.garenQRank === undefined) return undefined;
    const start = u.attackCycle.startTick,
      records = this.championState(u.id)?.garenQVisuals;
    if (!records) return undefined;
    for (let i = records.length - 1; i >= 0; i--) {
      const attack = records[i].attacks.find((a) => a.startTick === start);
      if (attack) return attack;
    }
    return undefined;
  }
  private finishAttackPresentation(
    u: Unit,
    reason: NonNullable<ChampionState['garenQVisuals'][number]['attacks'][number]['endReason']>
  ) {
    const state = this.championState(u.id);
    if (state) cancelGarenAttack(state, u, this.tick, reason);
    if (state) cancelMasterYiAttack(state, u, this.tick);
    if (state) finishLeonaAttack(state, u, this.tick, reason);
    const attack = this.garenQAttack(u);
    if (attack && attack.stopTick === null) {
      attack.stopTick = Math.min(this.tick, attack.endTick);
      attack.endReason = this.tick >= attack.endTick ? 'complete' : reason;
    }
  }
  private advanceUnit(u: Unit, attackOnly = false): void {
    if (u.kind === 'monster' && u.monster.species === 'scuttler') return;
    const state = this.championState(u.id);
    let target = u.attackTarget === null ? undefined : this.unit(u.attackTarget);
    if (u.releaseTick !== null) {
      if (!this.validTarget(u, target)) {
        this.finishAttackPresentation(u, 'target-lost');
        u.attackCycle = null;
        u.releaseTick = null;
        u.nextAttackTick = this.tick;
      } else {
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
        if (this.tick >= u.releaseTick) {
          u.releaseTick = null;
          if (!seenFrom(u, this.visionSources(target.team, false), this.battlefield.lineOfSight))
            this.visionAreas.push({
              kind: 'attack',
              x: u.x,
              y: u.y,
              radius: 300,
              team: target.team,
              endTick: this.tick + 120,
            });
          this.emit('attack', u, {
            unit: u.id,
            team: u.team,
            ...(u.attackCycle?.garenQRank !== undefined
              ? { champion: 'garen' as const, garenQStartTick: u.attackCycle.startTick }
              : u.champion === 'garen'
                ? { champion: 'garen' as const, garenAAStartTick: u.attackCycle!.startTick }
                : u.attackCycle?.leonaQRank !== undefined
                  ? {
                      champion: 'leona' as const,
                      leonaQStartTick: u.attackCycle.leonaQStartTick,
                      leonaQAttackStartTick: u.attackCycle.startTick,
                    }
                  : u.champion === 'leona'
                    ? { champion: 'leona' as const, leonaAAStartTick: u.attackCycle!.startTick }
                    : u.champion === 'masteryi'
                      ? {
                          champion: 'masteryi' as const,
                          masterYiAAStartTick: u.attackCycle!.startTick,
                        }
                      : {}),
          });
          if (
            u.champion === 'ashe' &&
            state &&
            state.spellRanks.q > 0 &&
            this.tick >= state.qUntil
          ) {
            state.qStacks = Math.min(ASHE_Q.maxStacks, state.qStacks + 1);
            state.qStackExpiry = this.tick + ASHE_Q.stackSeconds * TICK_RATE;
          }
          const empowered = state !== undefined && this.tick < state.qUntil;
          const critical = u.attackCycle?.critical === true;
          const attackDamage =
            u.damage *
            (isStructureKind(target.kind) ? 1 : this.basicAttackDamageMultiplier(u, critical));
          const payloads = empowered
            ? asheFocusFlurry(state.spellRanks.q, attackDamage)
            : [{ damage: attackDamage, appliesOnHit: true }];
          if (!u.missileSpeed) {
            const daybreakRank = u.champion === 'leona' ? u.attackCycle?.leonaQRank : undefined;
            if (
              daybreakRank !== undefined &&
              state &&
              state.leonaQ?.startTick === u.attackCycle?.leonaQStartTick
            )
              state.leonaQ = null;
            if (daybreakRank !== undefined && state) contactDaybreakVisual(this, u, target, state);
            const qRank = u.attackCycle?.garenQRank;
            // Initial Q adapter: only the ordinary attack portion rolls critical
            // damage; Q's native special critical multiplier remains unmapped.
            const qBonus = this.garenQBonusDamage(u, qRank);
            const history = this.garenQAttack(u);
            if (history)
              history.impact = {
                tick: this.tick,
                point: { x: target.x, y: target.y },
                facing: u.facing,
              };
            if (qRank !== undefined && state?.garenQ) {
              state.garenQ.consumed = true;
              expireGarenQ(state, this.tick);
            }
            if (u.champion === 'masteryi' && state)
              contactMasterYiAttack(state, u, target, this.tick, this);
            if (u.champion === 'garen' && qRank === undefined && state)
              contactGarenAttack(state, u, target, this.tick, this);
            if (u.champion === 'leona' && daybreakRank === undefined && state)
              contactLeonaAttack(this, u, state, target);
            this.hitBasicAttack(u, target, payloads.reduce((sum, p) => sum + p.damage, 0) + qBonus);
            if (u.champion === 'masteryi' && state?.doubleStrike && !this.winner) {
              const ready = countDoubleStrikeContact(state.doubleStrike, this.tick, true);
              if (ready && this.validTarget(u, target)) {
                const speed = this.attackSpeedMultiplier(u, target);
                const windup = Math.max(1, Math.round(u.windupTicks / speed));
                const critical =
                  !isStructureKind(target.kind) &&
                  this.criticalChance(u) > 0 &&
                  this.random.next() < this.criticalChance(u);
                const releaseTick = this.tick + windup;
                state.doubleStrike.strike = {
                  startTick: this.tick,
                  releaseTick,
                  endTick: Math.max(releaseTick + 1, u.nextAttackTick),
                  poseStopTick: null,
                  targetId: target.id,
                  damage:
                    u.damage *
                    MASTER_YI_PASSIVE.damageCoefficient *
                    (isStructureKind(target.kind)
                      ? 1
                      : this.basicAttackDamageMultiplier(u, critical)),
                  critical,
                  result: 'pending',
                };
                capturePassiveTrail(this, u, target);
              }
            }
            if (daybreakRank !== undefined) {
              const daybreak = leonaDaybreakValues(daybreakRank, this.abilityPower(u));
              this.damage(u, target, daybreak.bonusMagicDamage, 'magic');
              this.applySunlight(u, target);
              this.applyStun(target, Math.round(daybreak.stunSeconds * TICK_RATE));
              u.nextAttackTick = this.tick;
            }
            if (qRank !== undefined) {
              const duration = Math.round(GAREN_Q.silenceSeconds * TICK_RATE);
              if (this.applySilence(target, duration) && history)
                history.silenceEndTick = this.tick + this.controlDurationTicks(target, duration);
            }
          } else
            for (const [index, payload] of payloads.entries()) {
              const projectile: Projectile = {
                id: this.nextId++,
                x: u.x,
                y: u.y,
                previous: { x: u.x, y: u.y },
                origin: { x: u.x, y: u.y },
                source: u.id,
                team: u.team,
                type: 'attack',
                launchTick: this.tick + index * ASHE_FLURRY_INTERVAL_TICKS,
                empowered,
                ...(critical ? { critical: true as const } : {}),
                ...(empowered ? { flurryShot: index } : {}),
                target: target.id,
                direction: direction(u, target),
                damage: payload.damage,
                speed: u.missileSpeed,
                radius: 8,
                remaining: 4000,
                volleyId: null,
              };
              (index === 0 ? this.projectiles : this.pendingAttackProjectiles).push(projectile);
              if (u.kind === 'monster' && u.monster.species === 'gromp')
                this.grompAttackVisuals.push({
                  origin: { ...projectile.origin! },
                  id: projectile.id,
                  sourceId: u.id,
                  team: 'neutral',
                  launchTick: this.tick,
                  stopTick: null,
                  frames: [
                    {
                      tick: this.tick,
                      x: projectile.x,
                      y: projectile.y,
                      facing: Math.atan2(projectile.direction.x, projectile.direction.y),
                    },
                  ],
                });
              if (u.champion === 'lux')
                this.luxAttackVisuals.push({
                  origin: { x: u.x, y: u.y },
                  id: projectile.id,
                  sourceId: u.id,
                  team: u.team,
                  launchTick: this.tick,
                  stopTick: null,
                  frames: [
                    {
                      tick: this.tick,
                      x: projectile.x,
                      y: projectile.y,
                      facing: Math.atan2(projectile.direction.x, projectile.direction.y),
                      trailDistance: 0,
                    },
                  ],
                });
            }
        }
        return;
      }
    }
    if (attackOnly || u.stunUntil > this.tick) return;
    if (
      u.champion === 'leona' &&
      u.attackCycle?.leonaQRank !== undefined &&
      this.tick < u.attackCycle.endTick
    ) {
      if (u.order.type === 'move' || u.order.type === 'idle') u.attackCycle = null;
      else return;
    }
    if (u.order.type === 'attack') {
      const ordered = this.unit(u.order.target);
      target =
        this.validTarget(u, ordered) &&
        (u.kind !== 'turret' || distance(u, ordered!) <= u.range + ordered!.radius)
          ? ordered
          : undefined;
      if (!target) {
        this.setOrder(u, { type: 'idle' });
        // Stationary defenses must resume acquisition when retaliation ends.
        // A released missile and the next attack deadline remain independent.
        if (u.kind === 'turret') target = this.nearest(u, u.range);
      }
    } else if (u.order.type === 'attackMove' || u.kind === 'turret')
      target = this.nearest(u, u.kind === 'turret' ? u.range : 650);
    else target = undefined;
    if (target) {
      const inRange =
        distance(u, target) <=
        (state?.garenE ? 100 : u.champion === 'leona' ? this.attackRange(u) : u.range) +
          target.radius;
      if (inRange) {
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
        if (state?.garenE) return;
        if (this.tick >= u.nextAttackTick) {
          const speed = this.attackSpeedMultiplier(u, target);
          const state = this.championState(u.id);
          const garenQRank =
            u.champion === 'garen' &&
            state?.garenQ &&
            !state.garenQ.consumed &&
            this.tick < state.garenQ.attackUntil
              ? state.garenQ.rank
              : undefined;
          const qTiming = garenQRank !== undefined ? garenQAttackTimingAtLevel(state!.level) : null;
          const leonaQ =
            u.champion === 'leona' && state?.leonaQ && this.tick < state.leonaQ.endTick
              ? state.leonaQ
              : null;
          u.attackTarget = target.id;
          u.releaseTick =
            this.tick +
            (leonaQ
              ? LEONA_COMBAT_POLICY.daybreakWindupTicks
              : (qTiming?.windupTicks ?? Math.round(u.windupTicks / speed)));
          u.nextAttackTick = leonaQ
            ? u.releaseTick
            : this.tick + (qTiming?.periodTicks ?? Math.round(u.attackPeriod / speed));
          if (state) state.castAnimation = null;
          u.attackCycle = {
            startTick: this.tick,
            endTick: leonaQ ? this.tick + LEONA_COMBAT_POLICY.daybreakCycleTicks : u.nextAttackTick,
            empowered: state !== undefined && this.tick < state.qUntil,
            ...(garenQRank !== undefined ? { garenQRank, garenQReleaseTick: u.releaseTick } : {}),
            ...(u.kind === 'champion' &&
            !isStructureKind(target.kind) &&
            this.criticalChance(u) > 0 &&
            this.random.next() < this.criticalChance(u)
              ? { critical: true as const }
              : {}),
          };
          if (u.champion === 'leona' && !leonaQ && !u.attackCycle.critical && state?.leonaW)
            u.attackCycle.leonaEclipse = true;
          if (leonaQ) {
            u.attackCycle.leonaQRank = leonaQ.rank;
            u.attackCycle.leonaQStartTick = leonaQ.startTick;
            u.attackCycle.leonaQReleaseTick = u.releaseTick;
            captureDaybreakAttack(state!, leonaQ.startTick, this.tick);
          }
          if (u.champion === 'leona' && !leonaQ && state) beginLeonaAttack(this, u, state, target);
          if (u.champion === 'masteryi' && state) {
            beginMasterYiAttack(state, u, target, this.tick, this);
            advancePrimaryTrailRoots(this);
          }
          if (u.champion === 'garen' && garenQRank === undefined && state)
            beginGarenAttack(state, u, target, this.tick, this);
          const history = state?.garenQVisuals.at(-1);
          if (
            qTiming &&
            history?.stopTick === null &&
            history.startTick === state?.garenQ?.startTick
          )
            history.attacks.push({
              startTick: this.tick,
              releaseTick: u.releaseTick,
              endTick: u.nextAttackTick,
              targetId: target.id,
              origin: { x: u.x, y: u.y },
              facing: u.facing,
              stopTick: null,
              endReason: null,
              impact: null,
              landing: null,
              silenceEndTick: null,
            });
        }
        return;
      }
      if (u.kind !== 'turret') this.move(u, target);
    } else if (u.order.type === 'move' || u.order.type === 'attackMove') {
      this.move(u, u.order.point);
      if (u.order.type === 'move' && u.pathDestination && distance(u, u.pathDestination) < 3)
        this.setOrder(u, { type: 'idle' });
      else if (
        u.order.type === 'attackMove' &&
        u.lane !== null &&
        u.pathDestination &&
        distance(u, u.pathDestination) < 3 &&
        distance(u.pathDestination, u.order.point) < 150
      ) {
        const lane = this.battlefield.lanes[u.lane];
        const next = u.laneWaypoint + (u.team === 'blue' ? 1 : -1);
        if (next >= 0 && next < lane.points.length) {
          u.laneWaypoint = next;
          this.setOrder(u, { type: 'attackMove', point: lane.points[next] });
        } else if (distance(u.order.point, lane.spawns[u.team === 'blue' ? 'red' : 'blue']) > 1) {
          this.setOrder(u, {
            type: 'attackMove',
            point: lane.spawns[u.team === 'blue' ? 'red' : 'blue'],
          });
        }
      }
    }
  }
  private committedLeonaQ(u: Unit): boolean {
    return (
      u.champion === 'leona' &&
      LEONA_SPELLS.q.attackCannotCancelWindup &&
      LEONA_SPELLS.q.attackCanReleaseWhileDisabled &&
      !this.winner &&
      this.alive(u) &&
      u.releaseTick !== null &&
      u.attackCycle?.leonaQRank !== undefined
    );
  }
  attackRange(u: Unit): number {
    if (u.champion !== 'leona') return u.range;
    const q = this.championState(u.id)?.leonaQ;
    return u.range + (q && this.tick < q.endTick ? LEONA_COMBAT_POLICY.empoweredRangeBonus : 0);
  }
  /** The accepted child is independent of ordinary attack orders/cooldowns.
   * Its own disabled permission never makes an ordinary windup uncancellable. */
  private advanceDoubleStrike(source: Unit): void {
    const state = this.championState(source.id)?.doubleStrike;
    const strike = state?.strike;
    if (!strike || strike.result !== 'pending' || this.tick < strike.releaseTick) return;
    const target = this.unit(strike.targetId);
    strike.result = 'lost';
    if (!this.validTarget(source, target)) return;
    source.facing = Math.atan2(target.x - source.x, target.y - source.y);
    strike.result = 'hit';
    this.emit('attack', source, { unit: source.id, team: source.team });
    this.hitBasicAttack(source, target, strike.damage);
    if (!this.winner && this.alive(source)) countDoubleStrikeContact(state, this.tick, false);
  }
  private releaseZenith(source: Unit, cast: NonNullable<ChampionState['leonaEWindup']>): void {
    this.championState(source.id)!.leonaEWindup = null;
    const projectile: Projectile = {
      id: this.nextId++,
      source: source.id,
      team: source.team,
      type: 'zenith',
      x: source.x,
      y: source.y,
      previous: { x: source.x, y: source.y },
      origin: { x: source.x, y: source.y },
      launchTick: this.tick,
      direction: { ...cast.direction },
      target: null,
      volleyId: null,
      damage: cast.damage,
      speed: LEONA_SPELLS.e.missile.speed,
      radius: LEONA_COMBAT_POLICY.zenithRadius,
      remaining: LEONA_SPELLS.e.missile.castRange,
      zenith: { castTick: cast.startTick, rank: cast.rank, hits: [], lastChampionId: null },
    };
    this.projectiles.push(projectile);
    launchZenithVisual(this, source, projectile);
  }
  private beginLeonaDash(source: Unit, flight: Projectile): void {
    const target = this.unit(flight.zenith!.lastChampionId ?? -1);
    if (!target || target.kind !== 'champion' || !this.alive(target) || !this.targetable(target))
      return;
    // The final champion is rooted even if the missile owner has since died or
    // become unable to dash. A dead final champion never falls back to an earlier hit.
    this.applyRoot(target, Math.round(LEONA_SPELLS.e.rootSeconds * TICK_RATE));
    if (
      !this.alive(source) ||
      source.rootUntil > this.tick ||
      source.stunUntil > this.tick ||
      source.charm
    )
      return;
    const owner = this.championState(source.id)!;
    this.setOrder(source, { type: 'attack', target: target.id });
    if (!this.committedLeonaQ(source)) {
      source.releaseTick = null;
      source.attackTarget = null;
      source.attackCycle = null;
    }
    owner.leonaDash = {
      castTick: flight.zenith!.castTick,
      startTick: this.tick,
      targetId: target.id,
    };
    beginZenithDashVisual(this, source);
  }
  private finishLeonaDash(
    source: Unit,
    reason: ZenithDashEnd = 'arrived',
    control: { rootUntil: number; stunUntil: number; charmUntil?: number } = {
      rootUntil: source.rootUntil,
      stunUntil: source.stunUntil,
      ...(source.charm ? { charmUntil: source.charm.endTick } : {}),
    }
  ): void {
    const state = this.championState(source.id);
    if (!state?.leonaDash) return;
    const castTick = state.leonaDash.castTick,
      attemptPoint = { x: source.x, y: source.y };
    state.leonaDash = null;
    const landing = this.battlefield.reachable(
      source,
      source.radius,
      source.team === 'neutral' ? undefined : source.team
    );
    source.x = landing.x;
    source.y = landing.y;
    source.path = [];
    source.pathTarget = source.pathDestination = null;
    source.nextPathTick = this.tick;
    stopZenithDashVisual(this, source, reason, attemptPoint, castTick, control);
    // Control can interrupt between updates, including after terrain correction.
    advanceZenithVisuals(this);
  }
  private advanceLeonaDash(source: Unit, owner: ChampionState): void {
    const target = this.unit(owner.leonaDash!.targetId);
    if (
      !target ||
      !this.alive(target) ||
      source.rootUntil > this.tick ||
      source.stunUntil > this.tick ||
      !!source.charm
    ) {
      this.finishLeonaDash(source, !target || !this.alive(target) ? 'target-lost' : 'control');
      return;
    }
    const d = distance(source, target),
      dir = direction(source, target);
    const remaining = Math.max(0, d - source.radius - target.radius);
    const step = Math.min(remaining, LEONA_COMBAT_POLICY.zenithDashSpeed * DT);
    source.x += dir.x * step;
    source.y += dir.y * step;
    if (d > 0) source.facing = Math.atan2(dir.x, dir.y);
    if (step >= remaining) this.finishLeonaDash(source);
  }
  private move(u: Unit, point: Vec2): void {
    if (!u.speed || u.rootUntil > this.tick) return;
    if (
      (!u.pathTarget || distance(u.pathTarget, point) > 90 || !u.path.length) &&
      this.tick >= u.nextPathTick
    ) {
      u.path = this.battlefield.findPath(
        u,
        point,
        u.kind === 'monster' ? MONSTERS[u.monster.species].pathfindingRadius : u.radius,
        u.team === 'neutral' ? undefined : u.team
      );
      u.pathDestination = u.path.at(-1) ?? { x: u.x, y: u.y };
      u.nextPathTick = this.tick + 12;
      u.pathTarget = { x: point.x, y: point.y };
    }
    let remaining = this.movementSpeed(u) * DT;
    while (u.path.length && remaining > 0) {
      const waypoint = u.path[0],
        d = distance(u, waypoint);
      if (d === 0) {
        u.path.shift();
        continue;
      }
      const dir = direction(u, waypoint),
        amount = Math.min(d, remaining);
      const state = this.championState(u.id);
      if (state) state.castAnimation = null;
      this.finishAttackPresentation(u, 'action');
      u.x += dir.x * amount;
      u.y += dir.y * amount;
      u.facing = Math.atan2(dir.x, dir.y);
      remaining -= amount;
      if (amount === d) {
        u.x = waypoint.x;
        u.y = waypoint.y;
        u.path.shift();
      }
    }
  }
  movementSpeed(u: Unit): number {
    const owner = this.championState(u.id);
    const q = owner?.garenQ;
    const highlander = u.champion === 'masteryi' ? activeHighlander(owner, this.tick) : null;
    const haste =
      1 +
      (u.summonerHealSpeedUntil > this.tick ? SUMMONER_HEAL.speedBonus : 0) +
      (q && q.speedUntil > this.tick ? GAREN_Q.movementSpeedBonus : 0) +
      foxFireMovementBonus(this, u) +
      (highlander ? MASTER_YI_R.movementSpeedPercentByRank[highlander.rank - 1] / 100 : 0);
    const river =
      this.alive(u) &&
      this.scuttlers?.speedBuffs.some((s) => s.unitId === u.id && s.endTick > this.tick)
        ? SCUTTLER_POLICY.shrineSpeedFraction
        : 0;
    return u.speed * this.slowFactor(u) * (haste + river + companionMovementBonus(this, u));
  }
  perseveranceRegenPerSecond(u: Unit): number {
    if (u.champion !== 'garen' || !this.alive(u)) return 0;
    const state = this.championState(u.id)!;
    if (this.tick < state.garenPassiveReadyTick) return 0;
    return (
      (u.maxHp * GAREN_PASSIVE.maxHealthFractionByLevel[state.level - 1]) /
      GAREN_PASSIVE.ratePeriodSeconds
    );
  }
  private interruptPerseverance(source: Unit, target: Unit): void {
    if (
      this.winner ||
      target.champion !== 'garen' ||
      !this.alive(target) ||
      source.team === target.team
    )
      return;
    const state = this.championState(target.id)!;
    stopPerseveranceVisual(state, target, this.tick);
    state.garenPassiveReadyTick =
      this.tick + Math.round(GAREN_PASSIVE.interruptionSeconds * TICK_RATE);
  }
  slowFactor(u: Unit): number {
    if (u.champion === 'masteryi' && activeHighlander(this.championState(u.id), this.tick))
      return 1;
    // Retain the old diagnostic fields, but all new combat applications also
    // retain independent source/effect state so later hits cannot erase them.
    let slow = Math.min(
      u.slowUntil > this.tick ? u.slowMultiplier : 1,
      u.charm && u.charm.endTick > this.tick ? AHRI_E_POLICY.movementMultiplier : 1
    );
    const critical = u.criticalSlow;
    if (critical && this.tick < critical.endTick) {
      const progress = Math.max(
        0,
        (this.tick - critical.startTick) / (critical.endTick - critical.startTick)
      );
      slow = Math.min(
        slow,
        critical.startMultiplier + (critical.endMultiplier - critical.startMultiplier) * progress
      );
    }
    for (const effect of u.slows) {
      if (effect.startTick > this.tick || effect.endTick <= this.tick) continue;
      const progress = (this.tick - effect.startTick) / (effect.endTick - effect.startTick);
      slow = Math.min(
        slow,
        effect.startMultiplier + (effect.endMultiplier - effect.startMultiplier) * progress
      );
    }
    return slow;
  }
  applySlow(
    source: Unit,
    target: Unit,
    kind: Unit['slows'][number]['kind'],
    durationTicks: number,
    startMultiplier: number,
    endMultiplier = startMultiplier
  ): boolean {
    if (
      this.winner ||
      !this.units.includes(source) ||
      !this.units.includes(target) ||
      source.kind !== 'champion' ||
      source.team === target.team ||
      !this.alive(target) ||
      !this.targetable(target) ||
      (target.champion === 'masteryi' &&
        !!activeHighlander(this.championState(target.id), this.tick)) ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      (kind !== 'cinders' &&
        kind !== 'smite' &&
        kind !== 'scorchclaw' &&
        (kind === 'lucent'
          ? source.champion !== 'lux'
          : kind === 'solar-flare'
            ? source.champion !== 'leona'
            : source.champion !== 'ashe')) ||
      ![
        'frost',
        'critical-frost',
        'crystal-arrow',
        'lucent',
        'cinders',
        'smite',
        'scorchclaw',
        'solar-flare',
      ].includes(kind) ||
      (kind === 'solar-flare' &&
        (!this.championState(source.id)?.spellRanks.r ||
          durationTicks !== Math.round(LEONA_SPELLS.r.crowdControlSeconds * TICK_RATE) ||
          startMultiplier !== 1 - LEONA_SPELLS.r.slowFraction ||
          endMultiplier !== startMultiplier)) ||
      (kind === 'scorchclaw' &&
        !this.companions.some(
          (p) =>
            p.ownerId === source.id &&
            p.passive?.kind === 'scorchclaw' &&
            companionStage(p.fed) === 2
        )) ||
      (kind === 'smite' &&
        (!this.summonerSlot('smite', source.id) ||
          companionStage(ownedCompanion(this, source.id)?.fed ?? 0) === 0)) ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks) ||
      !Number.isFinite(startMultiplier) ||
      !Number.isFinite(endMultiplier) ||
      startMultiplier < 0 ||
      startMultiplier >= 1 ||
      endMultiplier < startMultiplier ||
      endMultiplier > 1
    )
      return false;
    const effect = {
      sourceId: source.id,
      kind,
      startTick: this.tick,
      endTick: this.tick + this.controlDurationTicks(target, durationTicks),
      startMultiplier,
      endMultiplier,
    };
    const index = target.slows.findIndex((s) => s.sourceId === source.id && s.kind === kind);
    this.interruptPerseverance(source, target);
    if (index === -1) target.slows.push(effect);
    else target.slows[index] = effect;
    return true;
  }
  /** Local tenacity policy: sample at application, with a 0.3s floor that
   * never lengthens an already shorter control. See docs/GAREN-W.md. */
  private controlDurationTicks(target: Unit, durationTicks: number): number {
    const courage = this.championState(target.id)?.garenW;
    if (!courage || this.tick >= courage.upfrontUntil) return durationTicks;
    return Math.min(
      durationTicks,
      Math.max(
        Math.round(0.3 * TICK_RATE),
        Math.round(durationTicks * (1 - GAREN_W.upfrontTenacity))
      )
    );
  }
  /** Local CC policy: latest Charm replaces prior Charm, sampling shared tenacity on impact.
   * Stun suspends walking; root prevents travel; committed non-channel casts still finish. */
  applyCharm(source: Unit, target: Unit, rank: number): boolean {
    if (
      this.winner ||
      source.champion !== 'ahri' ||
      !this.units.includes(source) ||
      !this.units.includes(target) ||
      source.team === target.team ||
      (this.championState(source.id)?.spellRanks.e ?? 0) < rank ||
      !this.alive(target) ||
      !this.targetable(target) ||
      (target.kind === 'monster' && target.monster.phase === 'returning') ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > 5
    )
      return false;
    const duration = Math.round(AHRI_E.charmSecondsByRank[rank - 1] * TICK_RATE),
      sampled = this.controlDurationTicks(target, duration);
    target.charm = {
      sourceId: source.id,
      rank,
      startTick: this.tick,
      endTick: this.tick + sampled,
      tenacityApplied: sampled !== duration,
    };
    const channelOwner = this.championState(target.id);
    if (channelOwner) finishMeditate(channelOwner, this, target, 'control');
    this.setOrder(target, { type: 'idle' });
    if (target.champion === 'leona') this.finishLeonaDash(target, 'control');
    stopSpiritDash(this, target, 'control');
    return true;
  }
  private advanceCharm(target: Unit): void {
    const source = this.unit(target.charm!.sourceId);
    if (!source || distance(source, target) <= source.radius + target.radius) {
      if (target.order.type !== 'idle') this.setOrder(target, { type: 'idle' });
      return;
    }
    // Follow the caster's current point (including its retained corpse), using ordinary terrain paths.
    const dir = direction(source, target),
      stop = source.radius + target.radius;
    const point = { x: source.x + dir.x * stop, y: source.y + dir.y * stop };
    target.order = { type: 'move', point };
    this.move(target, point);
  }
  private releaseCharm(source: Unit, cast: NonNullable<ChampionState['pendingCast']>): void {
    const dir = direction(source, cast.point);
    // Aim is selected at acceptance; no Flash-during-windup exception is introduced here.
    if (!dir.x && !dir.y) return;
    this.projectiles.push({
      id: this.nextId++,
      source: source.id,
      team: source.team,
      type: 'charm',
      charmRank: cast.rank,
      x: source.x,
      y: source.y,
      previous: { x: source.x, y: source.y },
      origin: { x: source.x, y: source.y },
      launchTick: this.tick,
      direction: dir,
      target: null,
      volleyId: null,
      damage: cast.damage,
      speed: AHRI_E.missile.speed,
      radius: AHRI_E_POLICY.radius,
      remaining: AHRI_E_POLICY.range,
    });
  }
  applyRoot(target: Unit, durationTicks: number): boolean {
    if (
      this.winner ||
      !this.alive(target) ||
      !this.targetable(target) ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks)
    )
      return false;
    const rootUntil = Math.max(
      target.rootUntil,
      this.tick + this.controlDurationTicks(target, durationTicks)
    );
    if (target.champion === 'leona')
      this.finishLeonaDash(target, 'control', { rootUntil, stunUntil: target.stunUntil });
    target.rootUntil = rootUntil;
    stopSpiritDash(this, target, 'control');
    return true;
  }
  applyStun(target: Unit, durationTicks: number): boolean {
    if (
      this.winner ||
      !this.units.includes(target) ||
      !this.alive(target) ||
      !this.targetable(target) ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks)
    )
      return false;
    const stunUntil = Math.max(
      target.stunUntil,
      this.tick + this.controlDurationTicks(target, durationTicks)
    );
    if (target.champion === 'leona')
      this.finishLeonaDash(target, 'control', { rootUntil: target.rootUntil, stunUntil });
    target.stunUntil = stunUntil;
    stopSpiritDash(this, target, 'control');
    const owner = this.championState(target.id);
    if (owner) {
      owner.recallEnd = null;
      finishMeditate(owner, this, target, 'control');
    }
    return true;
  }
  /** Silence blocks new spell actions without stopping movement/basic attacks.
   * Pending non-channel windups continue; an active Meditate is interrupted. */
  applySilence(target: Unit, durationTicks: number): boolean {
    if (
      this.winner ||
      !this.units.includes(target) ||
      !this.alive(target) ||
      !this.targetable(target) ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks)
    )
      return false;
    target.silenceUntil = Math.max(
      target.silenceUntil,
      this.tick + this.controlDurationTicks(target, durationTicks)
    );
    const state = this.championState(target.id);
    if (state) {
      state.recallEnd = null;
      finishMeditate(state, this, target, 'control');
    }
    return true;
  }
  /** Shared binding resolution primitive, also used by the queued Lux Q cast. */
  releaseLightBinding(source: Unit, point: Vec2, damage: number): boolean {
    if (
      this.winner ||
      source.kind !== 'champion' ||
      !this.units.includes(source) ||
      !this.alive(source) ||
      ![point.x, point.y, damage].every(Number.isFinite) ||
      damage < 0
    )
      return false;
    const dir = direction(source, point);
    if (!dir.x && !dir.y) return false;
    this.projectiles.push({
      id: this.nextId++,
      source: source.id,
      team: source.team,
      type: 'binding',
      x: source.x,
      y: source.y,
      previous: { x: source.x, y: source.y },
      origin: { x: source.x, y: source.y },
      launchTick: this.tick,
      direction: dir,
      target: null,
      damage,
      speed: LUX_BINDING.speed,
      radius: LUX_BINDING.radius,
      remaining: LUX_BINDING.range,
      volleyId: null,
      bindingHits: [],
      bindingAudioVariant: this.nextBindingAudioVariant,
    });
    this.nextBindingAudioVariant = this.nextBindingAudioVariant === 0 ? 1 : 0;
    return true;
  }
  private releaseSingularity(source: Unit, cast: NonNullable<ChampionState['pendingCast']>): void {
    const zoneId = this.nextId++;
    const record = this.luxEAudio.records.find(
      (r) => r.sourceId === source.id && r.startTick === cast.startTick
    );
    if (record)
      record.launch = {
        tick: this.tick,
        origin: { x: source.x, y: source.y },
        zoneId,
        ordinal: this.luxEAudio.counts.flight++,
      };
    this.singularities.push({
      id: zoneId,
      sourceId: source.id,
      team: source.team,
      x: source.x,
      y: source.y,
      previous: { x: source.x, y: source.y },
      origin: { x: source.x, y: source.y },
      point: { ...cast.point },
      launchTick: this.tick,
      arrivalTick: null,
      endTick: null,
      detonatedTick: null,
      detonateRequested: cast.detonateRequested!,
      damage: cast.damage,
      slowMultiplier: 1 - LUX_E.slowPercent[cast.rank - 1] / 100,
      hits: [],
    });
  }
  private singularityTargets(zone: Singularity): Unit[] {
    return this.units.filter(
      (u) =>
        u.team !== zone.team &&
        this.alive(u) &&
        this.targetable(u) &&
        !isStructureKind(u.kind) &&
        u.kind !== 'ward' &&
        distance(u, zone) <= LUX_E_POLICY.radius + u.radius
    );
  }
  private slowSingularity(zone: Singularity): void {
    const source = this.unit(zone.sourceId);
    if (!source) return;
    for (const target of this.singularityTargets(zone))
      this.applySlow(
        source,
        target,
        'lucent',
        LUX_E_POLICY.exitLingerSeconds * TICK_RATE,
        zone.slowMultiplier
      );
  }
  private advanceSingularities(): void {
    for (const zone of this.singularities) {
      zone.previous = { x: zone.x, y: zone.y };
      if (zone.detonatedTick !== null) continue;
      if (zone.arrivalTick === null) {
        const d = distance(zone, zone.point),
          dir = direction(zone, zone.point);
        const travel = Math.min(d, LUX_E.movementSpeed * DT);
        zone.x += dir.x * travel;
        zone.y += dir.y * travel;
        if (d > travel + 1e-8) continue;
        zone.x = zone.point.x;
        zone.y = zone.point.y;
        zone.arrivalTick = this.tick;
        zone.endTick = this.tick + LUX_E.zoneSeconds * TICK_RATE;
      }
      if (zone.detonateRequested || zone.endTick! <= this.tick) {
        // Retire before dealing damage so a death/victory cannot cause a second hit.
        zone.detonatedTick = this.tick;
        const source = this.unit(zone.sourceId);
        if (!source) continue;
        for (const target of this.singularityTargets(zone)) {
          recordLuxEHit(this, zone, target);
          this.damage(source, target, zone.damage, 'magic', 'area');
          this.applyIllumination(source, target);
          this.applySlow(
            source,
            target,
            'lucent',
            LUX_E.slowLingerSeconds * TICK_RATE,
            zone.slowMultiplier
          );
        }
      } else this.slowSingularity(zone);
    }
    this.singularities = this.singularities.filter(
      (z) =>
        z.detonatedTick === null ||
        this.tick < z.detonatedTick + LUX_E_POLICY.presentationSeconds * TICK_RATE
    );
  }
  private releasePrismatic(source: Unit, point: Vec2, shield: number, castTick: number): void {
    this.projectiles.push({
      id: this.nextId++,
      source: source.id,
      team: source.team,
      type: 'prismatic',
      x: source.x,
      y: source.y,
      previous: { x: source.x, y: source.y },
      origin: { x: source.x, y: source.y },
      launchTick: this.tick,
      direction: direction(source, point),
      target: null,
      damage: 0,
      speed: LUX_W.outwardSpeed,
      radius: LUX_W.radius,
      remaining: LUX_W.range,
      volleyId: null,
      prismatic: { phase: 'out', castTick, shield, hitsOut: [source.id], hitsReturn: [] },
    });
  }
  private applyPrismaticShield(source: Unit, target: Unit, amount: number, castTick: number): void {
    if (
      !this.alive(target) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(this.shieldAmount(target) + amount)
    )
      return;
    const previous = target.shields.find(
      (s) => s.sourceId === source.id && s.prismaticCastTick === castTick && s.endTick > this.tick
    );
    // Return adds to the unconsumed outgoing grant and refreshes it. Native comparison pending.
    if (previous) {
      previous.amount += amount;
      previous.endTick = this.tick + LUX_W.shieldSeconds * TICK_RATE;
    } else {
      const length = target.shields.length;
      this.applyShield(source, target, amount, LUX_W.shieldSeconds * TICK_RATE);
      if (target.shields.length === length) return;
      target.shields[target.shields.length - 1].prismaticCastTick = castTick;
    }
    if (source.id !== target.id) {
      const supporters = this.championState(target.id)!.supportContributors;
      const support = supporters.find((s) => s.sourceId === source.id);
      if (support) support.lastSupportTick = this.tick;
      else supporters.push({ sourceId: source.id, lastSupportTick: this.tick });
    }
  }
  private advancePrismatic(p: Projectile, source: Unit): boolean {
    const flight = p.prismatic!;
    if (!this.alive(source) && !flight.returnPoint)
      flight.returnPoint = { x: source.x, y: source.y };
    const returning = flight.phase === 'return';
    const destination = flight.returnPoint ?? source;
    if (returning) p.direction = direction(p, destination);
    const acceleration = returning ? LUX_W.returnAcceleration : LUX_W.outwardAcceleration;
    const limit = returning ? LUX_W.returnMaximumSpeed : LUX_W.outwardMinimumSpeed;
    const accelerating = Math.min(DT, Math.max(0, (limit - p.speed) / acceleration));
    const acceleratedSpeed = p.speed + acceleration * accelerating;
    const step =
      p.speed * accelerating +
      0.5 * acceleration * accelerating ** 2 +
      acceleratedSpeed * (DT - accelerating);
    p.speed = acceleratedSpeed;
    const distanceToCaster = returning
      ? Math.hypot(destination.x - p.x, destination.y - p.y)
      : Infinity;
    const travel = Math.min(step, p.remaining, distanceToCaster);
    const end = { x: p.x + p.direction.x * travel, y: p.y + p.direction.y * travel };
    const history = returning ? flight.hitsReturn : flight.hitsOut;
    const hits = this.units
      .flatMap((u) => {
        if (
          u.id === source.id ||
          u.kind !== 'champion' ||
          u.team !== p.team ||
          !this.alive(u) ||
          history.includes(u.id)
        )
          return [];
        const t = sweepCircle(p, end, u, p.radius + u.radius);
        return t === null ? [] : [{ unit: u, t }];
      })
      .sort((a, b) => a.t - b.t || a.unit.id - b.unit.id);
    for (const { unit } of hits) {
      history.push(unit.id);
      this.applyPrismaticShield(source, unit, flight.shield, flight.castTick);
    }
    p.x = end.x;
    p.y = end.y;
    p.remaining -= travel;
    if (returning && distanceToCaster <= travel + 1e-8) {
      if (!flight.returnPoint)
        this.applyPrismaticShield(source, source, flight.shield, flight.castTick);
      return false;
    }
    if (p.remaining > 1e-8) return true;
    if (returning) return false;
    flight.phase = 'return';
    p.speed = LUX_W.returnSpeed;
    p.remaining = LUX_W.returnRange;
    return true;
  }
  private unseenBeforeHawkshot(): Map<Team, Set<number>> {
    const unseen = new Map<Team, Set<number>>();
    for (const team of ['blue', 'red'] as const) {
      const active =
        this.projectiles.some((p) => p.type === 'hawkshot' && p.team === team) ||
        this.visionAreas.some(
          (a) =>
            a.kind === 'scout' &&
            a.team === team &&
            a.sourceId !== undefined &&
            a.endTick > this.tick
        ) ||
        this.units.some(
          (u) => u.team === team && this.championState(u.id)?.pendingCast?.ability === 'e'
        );
      if (active)
        unseen.set(
          team,
          new Set(
            this.units
              .filter(
                (u) =>
                  u.kind === 'champion' &&
                  u.team !== team &&
                  this.alive(u) &&
                  !this.visible(u, team)
              )
              .map((u) => u.id)
          )
        );
    }
    return unseen;
  }
  private creditHawkshotReveals(unseen: Map<Team, Set<number>>): void {
    for (const [team, ids] of unseen) {
      for (const id of ids) {
        const target = this.unit(id);
        if (!target || !this.alive(target) || !this.visible(target, team)) continue;
        ids.delete(id);
        // Simultaneous ordinary sight wins attribution. Continuous scout sight
        // does not refresh credit; another hidden-to-visible transition is needed.
        if (seenFrom(target, this.visionSources(team, true, false), this.battlefield.lineOfSight))
          continue;
        const flight = this.projectiles.find(
          (p) => p.type === 'hawkshot' && p.team === team && distance(p, target) <= 650
        );
        const area = this.visionAreas.find(
          (a) =>
            a.kind === 'scout' &&
            a.team === team &&
            a.endTick > this.tick &&
            a.sourceId !== undefined &&
            distance(a, target) <= a.radius
        );
        const sourceId = flight?.source ?? area?.sourceId;
        if (sourceId === undefined || !this.championState(sourceId)) continue;
        const state = this.championState(id)!;
        const entry = state.revealContributors.find((c) => c.sourceId === sourceId);
        if (entry) entry.lastRevealTick = this.tick;
        else state.revealContributors.push({ sourceId, lastRevealTick: this.tick });
      }
    }
  }
  private advanceAnimationClocks(): void {
    for (const unit of this.units) {
      const attack = this.garenQAttack(unit);
      if (
        attack &&
        attack.landing === null &&
        this.tick === garenQLandingTick(attack) &&
        (attack.stopTick === null || this.tick < attack.stopTick)
      )
        attack.landing = { tick: this.tick, point: { x: unit.x, y: unit.y }, facing: unit.facing };
      const mobileAlive = !isStructureKind(unit.kind) && unit.kind !== 'ward' && this.alive(unit);
      const moving =
        mobileAlive && Math.hypot(unit.x - unit.previous.x, unit.y - unit.previous.y) > 0.01;
      if (moving) {
        const nominal =
          (unit.champion === 'leona'
            ? championProfile('leona').speed
            : unit.kind === 'monster'
              ? MONSTERS[unit.monster.species].stats.speed
              : this.battlefield.unitStats?.[unit.kind]?.[unit.team]?.speed) ?? 325;
        const clock = unit.runClock ?? { startTick: this.tick, previous: 0, current: 0 };
        clock.previous = clock.current;
        clock.current += DT * (nominal > 0 ? this.movementSpeed(unit) / nominal : 1);
        unit.runClock = clock;
      } else unit.runClock = null;
      const state = this.championState(unit.id),
        cast = state?.castAnimation;
      const casting =
        !!state?.alphaStrike ||
        state?.meditate?.stopTick === null ||
        !!state?.garenE ||
        !!state?.leonaEWindup ||
        !!state?.leonaDash ||
        !!(state?.leonaR && !state.leonaR.released) ||
        (!!cast &&
          !!unit.champion &&
          (this.tick - cast.startTick) / TICK_RATE <
            castAnimationDuration(unit.champion, cast.ability));
      const secondary = state?.doubleStrike?.strike;
      const attacking =
        (unit.attackCycle !== null && this.tick < unit.attackCycle.endTick) ||
        (!!secondary && this.tick < secondary.endTick);
      if (
        mobileAlive &&
        !moving &&
        !casting &&
        !attacking &&
        state?.recallEnd == null &&
        !(unit.kind === 'monster' && unit.monster.spawn)
      ) {
        const clock = unit.idleClock ?? { startTick: this.tick, previous: 0, current: 0 };
        clock.previous = clock.current;
        clock.current += DT;
        unit.idleClock = clock;
      } else unit.idleClock = null;
      const durations = mobileClipDurations(unit);
      if (durations)
        unit.animationTimeline = advanceAnimationTimeline(
          unit.animationTimeline,
          mobilePose(unit, state, this.tick, 1, durations, 0, moving),
          this.tick,
          durations
        );
      if (unit.champion === 'masteryi') resolvePassiveTrailMarkers(this, unit);
    }
  }
  private captureImpactFrame(target: Unit) {
    return capturePoseFrame(target, this.tick);
  }
  private advanceMasterYiImpactVisuals(): void {
    if (!this.units.some((unit) => unit.champion === 'masteryi')) return;
    advancePrimaryHitPoses(this);
    advancePrimaryTrailRoots(this);
    advancePassiveTrails(this);
    advanceMeditateBuffs(this);
    advanceMeditateCasts(this);
    advanceSwordGlows(this);
    advanceMeditateDamage(this);
    advanceHighlanderKills(this);
    advanceHighlanderCasts(this);
    advanceAlphaEnds(this);
    advanceAlphaCasts(this);
    advanceAlphaContacts(this);
  }
  private advanceImpactVisuals(): void {
    this.advanceMasterYiImpactVisuals();
    advanceSolarVisuals(this);
    advanceZenithVisuals(this);
    advanceEclipseVisuals(this);
    advanceDaybreakVisuals(this);
    advanceSunlightVisuals(this);
    advanceGarenAttackPoses(this);
    advanceLeonaAttacks(this);
    advanceLeonaDeaths(this);
    advanceLuxEHits(this);
    for (const visual of [...this.luxImpactVisuals, ...this.luxIlluminationVisuals]) {
      const target = this.unit(visual.targetId);
      const previous = visual.frames.at(-1)!;
      const attached = visual.detachedTick === null && target;
      const frame = attached
        ? this.captureImpactFrame(target)
        : { ...structuredClone(previous), tick: this.tick };
      if (visual.detachedTick === null && (!target || !this.alive(target)))
        visual.detachedTick = this.tick;
      // Contact is discovered before damage; finalize even the first frame after
      // animation clocks and recall placement have reached this tick's endpoint.
      if (previous.tick === this.tick) visual.frames[visual.frames.length - 1] = frame;
      else visual.frames.push(frame);
    }
  }
  private advanceProjectiles(unseen: Map<Team, Set<number>>): void {
    const pending: Projectile[] = [];
    for (const p of this.pendingAttackProjectiles) {
      const target = p.target === null ? undefined : this.unit(p.target);
      if (!target || !this.alive(target)) continue;
      if (p.launchTick! <= this.tick) this.projectiles.push(p);
      else pending.push(p);
    }
    this.pendingAttackProjectiles = pending;
    const survivors: Projectile[] = [];
    const visualFrames = new Map<number, { tick: number; x: number; y: number; facing: number }>();
    const visualIds = new Set(
      [...this.luxAttackVisuals, ...this.grompAttackVisuals]
        .filter((v) => v.stopTick === null)
        .map((v) => v.id)
    );
    for (const p of this.projectiles) {
      p.previous = { x: p.x, y: p.y };
      if (visualIds.has(p.id))
        visualFrames.set(p.id, {
          tick: this.tick,
          x: p.x,
          y: p.y,
          facing: Math.atan2(p.direction.x, p.direction.y),
        });
      const source = this.unit(p.source);
      if (p.type === 'prismatic') {
        if (source && this.advancePrismatic(p, source)) survivors.push(p);
        continue;
      }
      const target = p.target === null ? undefined : this.unit(p.target);
      if (p.target !== null) {
        if (!target || !this.targetable(target)) continue;
        p.direction = direction(p, target);
      }
      let stepDistance = p.speed * DT;
      if (p.type === 'ultimate') {
        const acceleratingSeconds = Math.min(
          DT,
          Math.max(0, (ASHE_R.maximumSpeed - p.speed) / ASHE_R.acceleration)
        );
        // Integrate the accelerating portion, then travel at the cap for the remainder.
        stepDistance += ASHE_R.acceleration * acceleratingSeconds * (DT - acceleratingSeconds / 2);
        p.speed = Math.min(ASHE_R.maximumSpeed, p.speed + ASHE_R.acceleration * DT);
      }
      const travel = Math.min(stepDistance, p.remaining);
      const end = { x: p.x + p.direction.x * travel, y: p.y + p.direction.y * travel };
      if (visualIds.has(p.id))
        visualFrames.set(p.id, {
          tick: this.tick,
          ...end,
          facing: Math.atan2(p.direction.x, p.direction.y),
        });
      if (p.type === 'hawkshot') {
        p.x = end.x;
        p.y = end.y;
        p.remaining = Math.max(0, p.remaining - travel);
        if (p.remaining > 1e-8) survivors.push(p);
        else {
          const flight = {
            id: p.id,
            origin: { ...p.origin! },
            direction: { ...p.direction },
            speed: p.speed,
            launchTick: p.launchTick!,
            arrivalTick: this.tick,
            distance: distance(p.origin!, p),
          };
          const stopTick = this.tick + ASHE_E.visionSeconds * TICK_RATE;
          this.scoutVisuals.push({
            x: p.x,
            y: p.y,
            team: p.team,
            flight,
            stopTick,
            endTick: stopTick + Math.ceil(HAWKSHOT_PRESENTATION_TAIL_SECONDS * TICK_RATE),
          });
          this.visionAreas.push({
            kind: 'scout',
            sourceId: p.source,
            flight: {
              id: p.id,
              origin: p.origin!,
              direction: p.direction,
              speed: p.speed,
              launchTick: p.launchTick!,
              arrivalTick: this.tick,
              distance: distance(p.origin!, p),
            },
            x: p.x,
            y: p.y,
            radius: 650,
            unobstructed: true,
            team: p.team,
            endTick: stopTick,
          });
          this.emit('scout-arrival', p, { unit: p.source, team: p.team });
        }
        this.creditHawkshotReveals(unseen);
        continue;
      }
      if (p.type === 'zenith') {
        const hits = this.units
          .flatMap((unit) => {
            if (
              !this.alive(unit) ||
              !this.targetable(unit) ||
              unit.team === p.team ||
              isStructureKind(unit.kind) ||
              unit.kind === 'ward' ||
              (unit.kind === 'monster' && unit.monster.phase === 'returning') ||
              p.zenith!.hits.includes(unit.id)
            )
              return [];
            const t = sweepCircle(p, end, unit, p.radius + unit.radius);
            return t === null ? [] : [{ unit, t }];
          })
          .sort((a, b) => a.t - b.t || a.unit.id - b.unit.id);
        for (const { unit, t } of hits) {
          if (source) contactZenithVisual(this, source, p, unit, t, end);
          p.zenith!.hits.push(unit.id);
          if (unit.kind === 'champion') p.zenith!.lastChampionId = unit.id;
          if (source) {
            this.damage(source, unit, p.damage, 'magic', 'area');
            this.applySunlight(source, unit);
          }
        }
        p.x = end.x;
        p.y = end.y;
        p.remaining = Math.max(0, p.remaining - travel);
        if (source) captureZenithFlightFrame(this, source, p);
        if (p.remaining > 1e-8) survivors.push(p);
        else if (source) {
          finishZenithFlight(this, source, p);
          this.beginLeonaDash(source, p);
          settleZenithFlight(this, source, p);
        }
        continue;
      }
      if (p.type === 'charm') {
        const hit = this.units
          .flatMap((u) => {
            if (
              !this.alive(u) ||
              !this.targetable(u) ||
              u.team === p.team ||
              (u.kind === 'monster' && u.monster.phase === 'returning') ||
              isStructureKind(u.kind) ||
              u.kind === 'ward'
            )
              return [];
            const t = sweepCircle(p, end, u, p.radius + u.radius);
            return t === null ? [] : [{ unit: u, t }];
          })
          .sort((a, b) => a.t - b.t || a.unit.id - b.unit.id)[0];
        if (hit) {
          if (source) {
            this.damage(source, hit.unit, p.damage, 'magic');
            this.applyCharm(source, hit.unit, p.charmRank!);
          }
        } else {
          p.x = end.x;
          p.y = end.y;
          p.remaining = Math.max(0, p.remaining - travel);
          if (p.remaining > 1e-8) survivors.push(p);
        }
        continue;
      }
      if (p.type === 'binding') {
        const hits = this.units
          .flatMap((u) => {
            if (
              !this.alive(u) ||
              !this.targetable(u) ||
              u.team === p.team ||
              isStructureKind(u.kind) ||
              u.kind === 'ward' ||
              p.bindingHits!.includes(u.id)
            )
              return [];
            const t = sweepCircle(p, end, u, p.radius + u.radius);
            return t === null ? [] : [{ unit: u, t }];
          })
          .sort((a, b) => a.t - b.t || a.unit.id - b.unit.id);
        let stopPoint = end;
        for (const { unit, t } of hits) {
          p.bindingHits!.push(unit.id);
          if (source) {
            this.damage(source, unit, p.damage, 'magic', 'area');
            this.applyRoot(unit, LUX_BINDING.rootSeconds * TICK_RATE);
            this.interruptPerseverance(source, unit);
            this.applyIllumination(source, unit);
          }
          if (p.bindingHits!.length === LUX_BINDING.maximumTargets) {
            stopPoint = { x: p.x + (end.x - p.x) * t, y: p.y + (end.y - p.y) * t };
            break;
          }
        }
        p.x = end.x;
        p.y = end.y;
        p.remaining = Math.max(0, p.remaining - travel);
        if (p.bindingHits!.length < LUX_BINDING.maximumTargets && p.remaining > 1e-8)
          survivors.push(p);
        else
          this.bindingStops.push({
            id: p.id,
            sourceId: p.source,
            team: p.team,
            origin: { ...p.origin! },
            point: { ...stopPoint },
            launchTick: p.launchTick!,
            stopTick: this.tick,
            variant: p.bindingAudioVariant!,
            reason: p.bindingHits!.length === LUX_BINDING.maximumTargets ? 'hit-limit' : 'range',
          });
        continue;
      }
      let contact: Unit | undefined,
        first = Infinity;
      for (const u of this.units) {
        if (!this.alive(u) || !this.targetable(u) || u.team === p.team) continue;
        if (p.target !== null && u.id !== p.target) continue;
        if (p.type === 'ultimate' && u.kind !== 'champion' && u.kind !== 'dummy') continue;
        if (p.type !== 'attack' && (isStructureKind(u.kind) || u.kind === 'ward')) continue;
        const t = sweepCircle(p, end, u, p.radius + u.radius);
        if (t !== null && t < first) {
          contact = u;
          first = t;
        }
      }
      if (contact) {
        if (visualIds.has(p.id))
          visualFrames.set(p.id, {
            tick: this.tick,
            x: p.x + (end.x - p.x) * first,
            y: p.y + (end.y - p.y) * first,
            facing: Math.atan2(p.direction.x, p.direction.y),
          });
        if (source && (p.volleyId === null || !this.volleyHits[p.volleyId]?.includes(contact.id))) {
          if (p.type === 'attack' && source.champion === 'lux') {
            this.luxImpactVisuals.push({
              id: p.id,
              sourceId: source.id,
              targetId: contact.id,
              team: p.team,
              startTick: this.tick,
              critical: p.critical === true,
              detachedTick: null,
              targetRig: impactTargetRig(contact),
              targetTransform: contact.structureTransform ? [...contact.structureTransform] : null,
              frames: [this.captureImpactFrame(contact)],
            });
          }
          const level = this.championState(source.id)?.level ?? 1;
          const slow =
            ASHE_PASSIVE.slowAtLevel1 +
            ((ASHE_PASSIVE.slowAtLevel18 - ASHE_PASSIVE.slowAtLevel1) * (level - 1)) / 17;
          if (p.volleyId !== null) (this.volleyHits[p.volleyId] ??= []).push(contact.id);
          if (p.type === 'attack' && (p.flurryShot ?? 0) === 0)
            this.hitBasicAttack(source, contact, p.damage);
          else if (p.type === 'attack') this.damage(source, contact, p.damage, 'physical');
          else
            this.damage(
              source,
              contact,
              p.damage,
              p.type === 'ultimate' ? 'magic' : 'physical',
              'area'
            );
          if (
            source.champion === 'ashe' &&
            !(
              contact.champion === 'masteryi' &&
              activeHighlander(this.championState(contact.id), this.tick)
            ) &&
            !isStructureKind(contact.kind) &&
            contact.kind !== 'ward' &&
            (p.flurryShot ?? 0) === 0
          ) {
            contact.slowMultiplier = p.type === 'ultimate' ? 0.7 : 1 - slow;
            contact.slowUntil =
              this.tick +
              this.controlDurationTicks(contact, ASHE_PASSIVE.durationSeconds * TICK_RATE);
            this.applySlow(
              source,
              contact,
              p.type === 'ultimate' ? 'crystal-arrow' : 'frost',
              ASHE_PASSIVE.durationSeconds * TICK_RATE,
              contact.slowMultiplier
            );
            if (
              (p.type === 'volley' && contact.kind === 'champion') ||
              (p.type === 'attack' && p.critical)
            ) {
              const peak =
                ASHE_PASSIVE.criticalSlowAtLevel1 +
                ((ASHE_PASSIVE.criticalSlowAtLevel18 - ASHE_PASSIVE.criticalSlowAtLevel1) *
                  (level - 1)) /
                  17;
              contact.criticalSlow = {
                startTick: this.tick,
                endTick: this.tick + this.controlDurationTicks(contact, TICK_RATE),
                startMultiplier: 1 - peak,
                endMultiplier: 1 - slow,
              };
              this.applySlow(source, contact, 'critical-frost', TICK_RATE, 1 - peak, 1 - slow);
            }
          }
          if (p.type === 'ultimate') {
            const distanceTravelled = ASHE_R.range - p.remaining + travel * first;
            contact.stunUntil =
              this.tick +
              this.controlDurationTicks(contact, crystalArrowStunTicks(distanceTravelled));
            for (const victim of this.units) {
              if (
                victim.id === contact.id ||
                victim.team === p.team ||
                !this.alive(victim) ||
                isStructureKind(victim.kind) ||
                victim.kind === 'ward' ||
                distance(victim, contact) > ASHE_R.splashRadius
              )
                continue;
              this.damage(
                source,
                victim,
                p.damage * ASHE_R.splashDamageMultiplier,
                'magic',
                'area'
              );
              if (
                this.alive(victim) &&
                !(
                  victim.champion === 'masteryi' &&
                  activeHighlander(this.championState(victim.id), this.tick)
                )
              ) {
                victim.slowMultiplier = 1 - slow;
                victim.slowUntil =
                  this.tick +
                  this.controlDurationTicks(victim, ASHE_PASSIVE.durationSeconds * TICK_RATE);
                this.applySlow(
                  source,
                  victim,
                  'frost',
                  ASHE_PASSIVE.durationSeconds * TICK_RATE,
                  1 - slow
                );
              }
            }
          }
        }
      } else if (p.remaining - travel > 1e-8) {
        p.x = end.x;
        p.y = end.y;
        p.remaining -= travel;
        survivors.push(p);
      }
    }
    this.projectiles = this.winner ? [] : survivors;
    this.advanceAttackVisuals(visualFrames);
  }
  private advanceAttackVisuals(
    visualFrames = new Map<number, { tick: number; x: number; y: number; facing: number }>()
  ): void {
    const survivingIds = new Set(this.projectiles.map((p) => p.id));
    for (const visual of this.grompAttackVisuals) {
      if (visual.stopTick !== null) continue;
      const previous = visual.frames.at(-1);
      const frame = visualFrames.get(visual.id) ?? { ...previous!, tick: this.tick };
      if (previous?.tick === this.tick) visual.frames[visual.frames.length - 1] = frame;
      else visual.frames.push(frame);
      if (!survivingIds.has(visual.id)) visual.stopTick = this.tick;
      if (visual.frames.length > GROMP_ATTACK_PATH_FRAMES) visual.frames.shift();
    }
    for (const visual of this.luxAttackVisuals) {
      if (visual.stopTick !== null) continue;
      const previous = visual.frames.at(-1);
      const frame = visualFrames.get(visual.id) ?? { ...previous!, tick: this.tick };
      if (!survivingIds.has(visual.id)) visual.stopTick = this.tick;
      const relativeTick = this.tick - visual.launchTick;
      const stop = visual.stopTick === null ? Infinity : relativeTick;
      const count = luxEmissionCount(
        LUX_BASIC_TRAIL.rate,
        relativeTick,
        LUX_BASIC_TRAIL.emitterLife,
        stop
      );
      const priorCount = luxEmissionCount(
        LUX_BASIC_TRAIL.rate,
        relativeTick - 1,
        LUX_BASIC_TRAIL.emitterLife,
        stop
      );
      let trailDistance = previous?.trailDistance ?? 0;
      if (count > priorCount && priorCount > 0) {
        const priorBirth =
          visual.launchTick + luxEmissionBirthTick(LUX_BASIC_TRAIL.rate, priorCount);
        const anchor = visual.frames.find((f) => f.tick === priorBirth);
        if (!anchor) throw new Error('Missing Lux trail emission anchor');
        trailDistance += Math.hypot(frame.x - anchor.x, frame.y - anchor.y);
      }
      const recorded = { ...frame, trailDistance };
      if (previous?.tick === this.tick) visual.frames[visual.frames.length - 1] = recorded;
      else visual.frames.push(recorded);
      if (visual.frames.length > LUX_ATTACK_PATH_FRAMES) visual.frames.shift();
    }
  }
  attackSpeedMultiplier(source: Unit, target: Unit | undefined): number {
    const state = this.championState(source.id);
    const highlander = source.champion === 'masteryi' ? activeHighlander(state, this.tick) : null;
    if (highlander) {
      const bonus =
        (MASTER_YI.attackSpeedRatio * MASTER_YI_R.attackSpeedPercentByRank[highlander.rank - 1]) /
        100;
      return 1 + (bonus * source.attackPeriod) / TICK_RATE;
    }
    if (state && state.qUntil > this.tick) {
      // Q adds ratio-scaled attacks/second, not a multiplier on existing bonuses.
      const bonus = ASHE_Q.attackSpeedRatio * asheFocusValues(state.spellRanks.q).bonusAttackSpeed;
      return 1 + (bonus * source.attackPeriod) / TICK_RATE;
    }
    if (source.kind === 'siege' && target?.kind === 'turret' && target.structure?.lane === 'mid')
      return 1 + (this.battlefield.siegeMidTurretAttackSpeedBonus ?? 0);
    return 1;
  }
  private releaseFinalSpark(source: Unit, origin: Vec2, point: Vec2, raw: number): void {
    this.luxBeams.push({
      id: this.nextId++,
      sourceId: source.id,
      team: source.team,
      origin: { ...origin },
      point: { ...point },
      startTick: this.tick,
    });
    for (const target of this.units) {
      if (
        !this.alive(target) ||
        target.team === source.team ||
        isStructureKind(target.kind) ||
        target.kind === 'ward' ||
        !this.targetable(target) ||
        sweepCircle(origin, point, target, LUX_R.halfWidth + target.radius) === null
      )
        continue;
      const illuminated = target.illumination.some(
        (mark) => mark.sourceId === source.id && mark.endTick > this.tick
      );
      if (illuminated) this.captureIlluminationVisual(source, target);
      this.damage(source, target, raw, 'magic', 'area');
      if (illuminated && this.alive(target))
        this.damage(source, target, this.illuminationDamage(source), 'magic');
      this.applyIllumination(source, target);
    }
  }
  private captureIlluminationVisual(source: Unit, target: Unit): void {
    this.emit('illumination', target, { unit: target.id, team: source.team, champion: 'lux' });
    this.luxIlluminationVisuals.push({
      id: this.nextId++,
      sourceId: source.id,
      targetId: target.id,
      team: source.team,
      startTick: this.tick,
      critical: false,
      detachedTick: null,
      targetRig: impactTargetRig(target),
      targetTransform: null,
      frames: [this.captureImpactFrame(target)],
      audience: (['blue', 'red'] as const).filter((team) => this.visible(target, team)),
    });
  }
  private illuminationDamage(source: Unit): number {
    return (
      LUX_ILLUMINATION.baseDamageByLevel[this.championState(source.id)!.level - 1] +
      LUX_ILLUMINATION.abilityPowerRatio * this.abilityPower(source)
    );
  }
  private applyIllumination(source: Unit, target: Unit): void {
    if (
      source.champion !== 'lux' ||
      source.team === target.team ||
      !this.alive(target) ||
      !this.targetable(target) ||
      isStructureKind(target.kind) ||
      target.kind === 'ward'
    )
      return;
    const endTick = this.tick + LUX_ILLUMINATION.durationSeconds * TICK_RATE;
    const mark = target.illumination.find((entry) => entry.sourceId === source.id);
    if (mark) mark.endTick = endTick;
    else target.illumination.push({ sourceId: source.id, endTick });
  }
  /** Shared by Leona's damaging spells. Single mark/last-caster replacement is
   * the explicit local policy until native multi-Leona behavior is measured. */
  applySunlight(source: Unit, target: Unit): boolean {
    if (
      this.winner ||
      source.champion !== 'leona' ||
      !this.championState(source.id) ||
      !this.units.includes(target) ||
      !this.alive(target) ||
      !this.targetable(target) ||
      source.team === target.team ||
      isStructureKind(target.kind) ||
      target.kind === 'ward' ||
      (target.kind === 'monster' && target.monster.phase === 'returning')
    )
      return false;
    const endTick = this.tick + Math.round(LEONA_SUNLIGHT.markSeconds * TICK_RATE);
    if (!Number.isSafeInteger(endTick)) return false;
    target.sunlight = { sourceId: source.id, startTick: this.tick, endTick };
    return true;
  }
  private consumeSunlight(trigger: Unit, target: Unit): void {
    const mark = target.sunlight;
    if (!mark) return;
    if (mark.endTick <= this.tick) {
      target.sunlight = null;
      return;
    }
    const source = this.unit(mark.sourceId),
      owner = this.championState(mark.sourceId);
    if (!source || !owner || source.champion !== 'leona') {
      target.sunlight = null;
      return;
    }
    if (
      trigger.kind !== 'champion' ||
      trigger.id === source.id ||
      trigger.team !== source.team ||
      trigger.team === target.team ||
      !this.alive(target)
    )
      return;
    // Retire before nested damage. Leona owns effects; the ally owns kill credit.
    captureSunlightVisual(this, source, target);
    target.sunlight = null;
    this.damage(source, target, leonaSunlightDamage(owner.level), 'magic', 'proc', trigger);
    advanceSunlightVisuals(this);
  }
  /** Shared by actual melee release and the conservative, non-critical farm forecast. */
  private garenQBonusDamage(source: Unit, rank: number | undefined): number {
    return rank === undefined
      ? 0
      : GAREN_Q.baseDamageByRank[rank - 1] + (GAREN_Q.totalAttackDamageRatio - 1) * source.damage;
  }
  private hitBasicAttack(source: Unit, target: Unit, raw: number): void {
    if (
      source.champion === 'masteryi' &&
      source.team !== target.team &&
      this.targetable(target) &&
      !(target.kind === 'monster' && target.monster.phase === 'returning')
    )
      reduceAlphaCooldown(this, source);
    if (target.kind === 'ward') {
      hitWard(this, source, target);
      return;
    }
    const canApplyOnHitEffects =
      this.targetable(target) &&
      !isStructureKind(target.kind) &&
      !(target.kind === 'monster' && target.monster.phase === 'returning');
    const turretHealthRatio =
      source.kind === 'turret' && source.structure && isLaneMinionKind(target.kind)
        ? this.battlefield.turretMinionHealthDamage?.[target.kind]?.[source.structure.role]
        : undefined;
    if (turretHealthRatio !== undefined) {
      this.damage(source, target, target.maxHp * turretHealthRatio, 'physical');
      return;
    }
    const multiplier =
      target.kind === 'turret' && isLaneMinionKind(source.kind)
        ? (this.battlefield.minionTurretDamage?.[source.kind] ?? 1)
        : 1;
    const healthRatio =
      source.kind !== 'monster' && isLaneMinionKind(source.kind) && isLaneMinionKind(target.kind)
        ? (this.battlefield.minionCurrentHealthDamage?.[source.kind]?.[source.team] ?? 0)
        : 0;
    // Sample at impact, before this hit changes HP. Ranged attacks retain release AD.
    const illuminated =
      source.champion === 'lux' &&
      this.targetable(target) &&
      target.illumination.some((mark) => mark.sourceId === source.id && mark.endTick > this.tick);
    if (illuminated) this.captureIlluminationVisual(source, target);
    if (illuminated)
      target.illumination = target.illumination.filter((mark) => mark.sourceId !== source.id);
    this.damage(source, target, raw * multiplier + target.hp * healthRatio, 'physical');
    if (illuminated && this.alive(target)) {
      this.damage(source, target, this.illuminationDamage(source), 'magic');
    }
    this.applyAttackOnHitEffects(source, target, canApplyOnHitEffects, 1);
  }
  hitAlphaStrike(
    source: Unit,
    target: Unit,
    raw: number,
    onHitScale: number,
    mark: AlphaStrikeMark
  ): boolean {
    if (!alphaTarget(this, source, target)) return false;
    captureAlphaContact(this, source, target, mark);
    contactAlphaAudio(this, source, target, mark);
    this.damage(source, target, raw, 'physical', 'area');
    this.applyAttackOnHitEffects(source, target, true, onHitScale);
    return true;
  }
  private applyAttackOnHitEffects(
    source: Unit,
    target: Unit,
    canApplyOnHitEffects: boolean,
    onHitScale: number
  ): void {
    const owner = this.championState(source.id);
    if (source.champion === 'masteryi' && owner && canApplyOnHitEffects && this.alive(target)) {
      const trueDamage = wujuStyleDamage(source, owner, this.tick);
      if (trueDamage > 0) this.damage(source, target, trueDamage * onHitScale, 'true', 'proc');
    }
    if (
      canApplyOnHitEffects &&
      owner &&
      redBuffActive(owner, this.tick) &&
      this.alive(target) &&
      source.team !== target.team
    ) {
      this.applySlow(
        source,
        target,
        'cinders',
        CREST_OF_CINDERS.slowDurationSeconds * TICK_RATE,
        1 - cinderSlow(owner.level, isMeleeChampion(source.champion))
      );
      const old = target.cinderBurn;
      const refreshing = old && old.endTick > this.tick;
      target.cinderBurn = {
        sourceId: source.id,
        phaseTick: refreshing ? old.phaseTick : this.tick,
        appliedTick: this.tick,
        endTick: this.tick + CINDER_BURN_TICKS,
        nextTick: refreshing ? old.nextTick : this.tick + CINDER_BURN_INTERVAL,
        damagePerTick: cinderDamagePerTick(owner.level),
      };
      if (!refreshing) this.damage(source, target, target.cinderBurn.damagePerTick, 'true', 'proc');
    }
  }
  /** A burn outlives its holder's buff/death. Refresh preserves its pulse phase. */
  private advanceCinderBurns(): void {
    for (const target of this.units) {
      const burn = target.cinderBurn;
      if (!burn) continue;
      const source = this.unit(burn.sourceId);
      if (
        !source ||
        !this.alive(target) ||
        this.tick > burn.endTick ||
        (target.kind === 'monster' && target.monster.phase === 'returning')
      ) {
        target.cinderBurn = null;
        continue;
      }
      if (this.tick >= burn.nextTick) {
        burn.nextTick =
          burn.phaseTick +
          (Math.floor((this.tick - burn.phaseTick) / CINDER_BURN_INTERVAL) + 1) *
            CINDER_BURN_INTERVAL;
        this.damage(source, target, burn.damagePerTick, 'true', 'proc');
      }
      if (this.tick >= burn.endTick) target.cinderBurn = null;
    }
  }
  /** One support hop from direct contributors; see docs/SUMMONER-HEAL.md. */
  private takedownContributors(victim: ChampionState, killerId?: number): Set<number> {
    const direct = new Set([
      ...victim.damageContributors
        .filter((entry) => this.tick - entry.lastDamageTick <= ASSIST_WINDOW_SECONDS * TICK_RATE)
        .map((entry) => entry.sourceId),
      ...victim.revealContributors
        .filter((entry) => this.tick - entry.lastRevealTick <= HAWKSHOT_ASSIST_SECONDS * TICK_RATE)
        .map((entry) => entry.sourceId),
      ...victim.alphaMarkContributors
        .filter((entry) => this.tick - entry.lastMarkTick <= ASSIST_WINDOW_SECONDS * TICK_RATE)
        .map((entry) => entry.sourceId),
    ]);
    if (killerId !== undefined) direct.add(killerId);
    const contributors = new Set(direct);
    for (const id of direct) {
      for (const support of this.championState(id)?.supportContributors ?? []) {
        if (this.tick - support.lastSupportTick <= ASSIST_WINDOW_SECONDS * TICK_RATE)
          contributors.add(support.sourceId);
      }
    }
    return contributors;
  }
  shieldAmount(target: Unit): number {
    return target.shields.reduce(
      (sum, shield) => sum + (shield.endTick > this.tick ? shield.amount : 0),
      0
    );
  }
  /** Stored armor excludes temporary bonuses so purchases and growth cannot drift. */
  armorWithBuffs(target: Unit): number {
    return (
      target.armor +
      (target.champion === 'leona'
        ? eclipseResistances(target, this.championState(target.id)!, this.tick).armor
        : 0)
    );
  }
  /** Same named armor reduction does not stack across Garen owners. */
  effectiveArmor(target: Unit): number {
    const armor = this.armorWithBuffs(target);
    return armor > 0 && target.garenEShreds.some((shred) => shred.endTick > this.tick)
      ? armor * (1 - GAREN_E.armorReduction)
      : armor;
  }
  effectiveMagicResist(target: Unit): number {
    return (
      target.magicResist +
      (target.champion === 'leona'
        ? eclipseResistances(target, this.championState(target.id)!, this.tick).magicResist
        : 0)
    );
  }
  /** Shared with observed spell forecasts; outgoing amplification precedes this. */
  mitigatedDamage(target: Unit, raw: number, kind: 'physical' | 'magic' | 'true'): number {
    if (kind === 'true') return raw;
    const owner = this.championState(target.id);
    if (target.champion === 'leona' && owner) raw = eclipseReducedRaw(raw, owner, this.tick);
    const courage = owner?.garenW;
    const reduction =
      courage && this.tick < courage.defenseUntil
        ? GAREN_W.damageReductionByRank[courage.rank - 1]
        : 0;
    return (
      damageAfterResistance(
        raw,
        kind === 'physical' ? this.effectiveArmor(target) : this.effectiveMagicResist(target)
      ) *
      (1 - reduction)
    );
  }
  private advanceLeonaSolarFlare(state: ChampionState): void {
    const flare = state.leonaR!,
      source = this.unit(state.id)!;
    if (this.winner || (!this.alive(source) && this.tick < flare.releaseTick)) {
      finishSolarVisual(state, this.tick, this.winner ? 'match-end' : 'death');
      state.leonaR = null;
      return;
    }
    if (this.tick >= flare.releaseTick && !flare.released) {
      releaseSolarVisual(this, source, state);
      flare.released = true;
    }
    if (this.tick < flare.impactTick) return;
    // Retire before damage/CC callbacks. Capture geometry for every participant
    // before any hit can kill or displace another target.
    const victims = this.units
      .filter(
        (target) =>
          target.team !== source.team &&
          this.alive(target) &&
          this.targetable(target) &&
          !isStructureKind(target.kind) &&
          target.kind !== 'ward' &&
          !(target.kind === 'monster' && target.monster.phase === 'returning') &&
          distance(target, flare.point) <= LEONA_SPELLS.r.authoredOuterRadius + target.radius
      )
      .map((target) => ({
        target,
        center: distance(target, flare.point) <= LEONA_SPELLS.r.authoredInnerRadius + target.radius,
      }))
      .sort((a, b) => a.target.id - b.target.id);
    impactSolarVisual(this, state, victims);
    state.leonaR = null;
    const duration = Math.round(LEONA_SPELLS.r.crowdControlSeconds * TICK_RATE);
    for (const { target, center } of victims) {
      this.damage(source, target, flare.damage, 'magic', 'area');
      this.applySunlight(source, target);
      if (center) this.applyStun(target, duration);
      else this.applySlow(source, target, 'solar-flare', duration, 1 - LEONA_SPELLS.r.slowFraction);
    }
  }
  private advanceLeonaEclipse(state: ChampionState): void {
    const eclipse = state.leonaW!,
      source = this.unit(state.id)!;
    if (!this.alive(source) || this.winner) {
      finishEclipseVisual(state, this.tick, this.winner ? 'match-end' : 'death');
      state.leonaW = null;
      return;
    }
    if (!eclipse.detonated && this.tick >= eclipse.detonationTick) {
      // Explicit local policy: one pre-command burst from the current position,
      // inclusive edge overlap, no visibility/line-of-sight requirement.
      const victims = this.units.filter(
        (target) =>
          target.team !== source.team &&
          this.alive(target) &&
          this.targetable(target) &&
          !isStructureKind(target.kind) &&
          target.kind !== 'ward' &&
          !(target.kind === 'monster' && target.monster.phase === 'returning') &&
          distance(source, target) <= LEONA_COMBAT_POLICY.eclipseRadius + target.radius
      );
      captureEclipseDetonation(this, source, state, victims);
      if (victims.length) {
        eclipse.detonated = true;
        eclipse.endTick = eclipse.detonationTick + LEONA_COMBAT_POLICY.eclipseDurationTicks;
      } else state.leonaW = null;
      const damage = leonaEclipseValues(eclipse.rank, this.abilityPower(source), 0, 0).magicDamage;
      for (const victim of victims) {
        this.damage(source, victim, damage, 'magic', 'area');
        this.applySunlight(source, victim);
      }
    } else if (this.tick >= eclipse.endTick) {
      finishEclipseVisual(state, this.tick, 'expired');
      state.leonaW = null;
    }
  }
  /** Independent shield grants; ability-specific stacking belongs to the spell adapter. */
  applyShield(source: Unit, target: Unit, amount: number, durationTicks: number): void {
    if (
      this.winner ||
      !this.units.includes(source) ||
      !this.units.includes(target) ||
      source.kind !== 'champion' ||
      target.kind !== 'champion' ||
      source.team !== target.team ||
      !this.alive(target) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks) ||
      !Number.isFinite(this.shieldAmount(target) + amount)
    )
      return;
    target.shields.push({ sourceId: source.id, amount, endTick: this.tick + durationTicks });
  }
  damage(
    source: Unit,
    target: Unit,
    raw: number,
    kind: 'physical' | 'magic' | 'true',
    category:
      | 'direct'
      | 'area'
      | 'cleanup'
      | 'summoner'
      | 'companion'
      | 'proc'
      | 'companion-passive' = 'direct',
    creditSource?: Unit
  ): void {
    // Delegation currently belongs only to Sunlight. Ordinary callers retain
    // the existing source contract, including dead projectile owners.
    if (
      creditSource &&
      (source.champion !== 'leona' ||
        category !== 'proc' ||
        creditSource.kind !== 'champion' ||
        creditSource.id === source.id ||
        creditSource.team !== source.team ||
        creditSource.team === target.team ||
        !this.championState(source.id) ||
        !this.championState(creditSource.id))
    )
      return;
    if (
      this.winner ||
      target.kind === 'ward' ||
      !this.alive(target) ||
      !this.vulnerable(target) ||
      (target.kind === 'monster' && target.monster.phase === 'returning')
    )
      return;
    const courage = this.championState(target.id)?.garenW;
    const reduction =
      kind !== 'true' && courage && this.tick < courage.defenseUntil
        ? GAREN_W.damageReductionByRank[courage.rank - 1]
        : 0;
    const channelReduction =
      kind !== 'true' && target.champion === 'masteryi'
        ? meditateReduction(this.championState(target.id), this.tick, source.kind === 'turret')
        : 0;
    const amount = this.mitigatedDamage(
      target,
      raw *
        companionDamageMultiplier(this, source, target, category, kind) *
        (1 - channelReduction),
      kind
    );
    // Explicit local W_Dmg policy: coalesce positive reduced damage once per owner/tick.
    // Includes linger, shields and lethal damage; true/zero damage creates no reaction.
    if (amount > 0 && channelReduction > 0)
      captureMeditateDamage(this, target, this.championState(target.id)!);
    // Local presentation policy: positive damage actually reduced by W emits
    // one reaction per victim/tick, including fully shielded and lethal hits.
    // True damage bypasses reduction. Native trigger/coalescing remain unverified.
    if (amount > 0 && reduction > 0 && courage) {
      const reactions = this.championState(target.id)!.garenWDeflects;
      if (reactions.at(-1)?.tick !== this.tick)
        reactions.push({ tick: this.tick, castTick: courage.startTick });
    }
    if (amount > 0 && (source.kind === 'champion' || source.kind === 'turret'))
      this.interruptPerseverance(source, target);
    let remainder = Math.max(0, amount);
    if (amount > 0 && category !== 'cleanup') noteCompanionPassiveCombat(this, source, target);
    let absorbed = 0;
    // Earliest-expiring shield first; stable insertion order breaks equal-deadline ties.
    target.shields.sort((a, b) => a.endTick - b.endTick);
    for (const shield of target.shields) {
      if (shield.endTick <= this.tick) continue;
      const used = Math.min(shield.amount, remainder);
      shield.amount -= used;
      remainder -= used;
      absorbed += used;
      if (remainder === 0) break;
    }
    target.shields = target.shields.filter(
      (shield) => shield.amount > 0 && shield.endTick > this.tick
    );
    const healthLost = Math.min(target.hp, remainder);
    target.hp = Math.max(0, target.hp - remainder);
    if (healthLost > 0 && target.kind === 'monster') target.monster.spawn = null;
    const attacker = this.championState(source.id);
    if (
      category !== 'summoner' &&
      category !== 'companion' &&
      category !== 'companion-passive' &&
      attacker?.inventory.includes('blade') &&
      this.alive(source) &&
      source.team !== target.team &&
      (target.kind === 'champion' || isLaneMinionKind(target.kind))
    ) {
      const effectiveness =
        category === 'area' && isLaneMinionKind(target.kind) ? MINION_AREA_OMNIVAMP_MULTIPLIER : 1;
      const healing = Math.min(
        source.maxHp - source.hp,
        (healthLost + absorbed) * DORANS_BLADE_OMNIVAMP * effectiveness
      );
      if (healing > 0) {
        source.hp += healing;
        this.emit('heal', source, { value: Math.round(healing) });
      }
    }
    if (healthLost > 0 && target.kind === 'monster' && source.team !== 'neutral') {
      if (category !== 'companion') noteCompanionCombat(this, source, target);
      // A dead damage owner cannot become an attack target. Delegated damage
      // can use its living triggering ally; otherwise preserve existing aggro.
      const aggressor = this.alive(source)
        ? source
        : creditSource && this.alive(creditSource)
          ? creditSource
          : undefined;
      for (const member of this.monsterGroup(target)) {
        if (!this.alive(member) || !this.targetable(member) || member.monster.phase === 'returning')
          continue;
        if (member.monster.scuttle) {
          member.monster.scuttle.lastDamageTick = this.tick;
          member.monster.scuttle.grazeUntil = null;
          member.monster.scuttle.nextThinkTick = this.tick;
        }
        if (!aggressor) {
          if (member.monster.phase === 'idle' && member.monster.species !== 'scuttler') {
            member.monster.phase = 'returning';
            member.monster.targetId = null;
            member.sunlight = null;
            this.setOrder(member, { type: 'move', point: { ...member.monster.home } });
          }
          continue;
        }
        member.monster.phase = 'engaged';
        member.monster.targetId = aggressor.id;
        member.monster.spawn = null;
        if (member.monster.scuttle) {
          member.monster.scuttle.fleeUntil = this.tick + SCUTTLER_POLICY.fleeTicks;
        }
      }
    }
    if (category !== 'cleanup')
      this.emit('damage', target, {
        unit: target.id,
        value: Math.round(amount),
        team: source.team,
      });
    const targetState = this.championState(target.id);
    if (targetState) {
      if (
        amount > 0 &&
        source.team !== target.team &&
        (source.kind === 'champion' || source.kind === 'turret')
      )
        targetState.redBuffHealReadyTick = this.tick + RED_HEAL_LOCKOUT_TICKS;
      if (healthLost > 0) targetState.recallEnd = null;
      if (amount > 0 && source.team !== target.team && this.championState(source.id)) {
        const index = targetState.damageContributors.findIndex(
          (entry) => entry.sourceId === source.id
        );
        // Order by actual damage processing, including multiple hits in one tick.
        // Refreshing in place loses which attacker most recently contributed.
        if (index !== -1) targetState.damageContributors.splice(index, 1);
        const contribution: ChampionState['damageContributors'][number] = {
          sourceId: source.id,
          lastDamageTick: this.tick,
        };
        if (creditSource) contribution.creditSourceId = creditSource.id;
        targetState.damageContributors.push(contribution);
      }
    }
    if (target.kind === 'champion' && source.kind !== 'monster')
      for (const turret of this.units) {
        if (
          turret.kind === 'turret' &&
          turret.team === target.team &&
          this.alive(turret) &&
          distance(turret, source) <= turret.range
        )
          turret.order = { type: 'attack', target: source.id };
      }
    if (target.hp === 0) {
      this.pendingAttackProjectiles = this.pendingAttackProjectiles.filter(
        (p) => p.target !== target.id
      );
      target.deadAt = this.tick;
      if (target.kind === 'monster') {
        if (target.monster.species === 'scuttler') {
          scuttlerKilled(this, target, source);
          target.monster.scuttle!.fleeUntil = null;
          target.monster.scuttle!.grazeUntil = null;
        }
        target.monster.phase = 'idle';
        target.monster.targetId = null;
        const camp = this.jungleCamps.find((c) => c.unitIds.includes(target.id));
        if (camp) {
          const definition = RIFT_CAMPS.find((c) => c.id === camp.id)!;
          const slot = camp.unitIds.indexOf(target.id);
          camp.unitIds[slot] = null;
          camp.cleanupTicks[slot] = null;
          if (definition.splits.some((s) => s.parentSlot === slot))
            camp.splitWaves.push({
              parentSlot: slot,
              parentId: target.id,
              deathTick: this.tick,
              readyTick: this.tick + definition.splitDelayTicks,
              point: { x: target.x, y: target.y },
              facing: target.facing,
              targetId: source.kind === 'champion' ? source.id : null,
              status: category === 'cleanup' ? 'cancelled' : 'pending',
            });
          if (
            camp.unitIds.every((id) => id === null) &&
            !camp.splitWaves.some((s) => s.status === 'pending')
          ) {
            camp.nextSpawnTick = this.tick + definition.respawnTicks;
            camp.cleanupTicks = definition.members.map(() => null);
            camp.splitWaves = [];
          } else if (slot === 0 && definition.cleanupDelayTicks !== null)
            camp.cleanupTicks = camp.unitIds.map((id) =>
              id === null ? null : this.tick + definition.cleanupDelayTicks!
            );
        }
      }
      target.shields = [];
      target.slows = [];
      target.illumination = [];
      target.sunlight = null;
      target.cinderBurn = null;
      target.scorchclawBurns = [];
      target.releaseTick = null;
      this.finishAttackPresentation(target, 'death');
      target.attackCycle = null;
      target.order = { type: 'idle' };
      this.emit('death', target, { unit: target.id });
      if (target.champion === 'leona') captureLeonaDeath(targetState!, target, this.events.at(-1)!);
      // Structure destruction is public map knowledge. It grants no live sight
      // and does not broaden the audience of the preceding damage event.
      if (target.structureKnowledge)
        target.structureKnowledge = { blue: this.tick, red: this.tick };
      if (target.kind === 'champion') {
        if (this.scuttlers)
          this.scuttlers.speedBuffs = this.scuttlers.speedBuffs.filter(
            (s) => s.unitId !== target.id
          );
        const level = targetState?.level ?? 1;
        target.respawnTick = this.tick + championDeathTicks(level, this.tick);
      }
      if (target.kind === 'dummy') target.respawnTick = this.tick + 3 * TICK_RATE;
      if (target.kind === 'inhibitor')
        target.respawnTick = this.tick + STRUCTURE_RESPAWN_TICKS.inhibitor;
      if (target.structure?.role === 'nexus-turret')
        target.respawnTick = this.tick + STRUCTURE_RESPAWN_TICKS['nexus-turret'];
      if (target.kind === 'nexus') {
        this.winner = target.team === 'blue' ? 'red' : 'blue';
        for (const state of this.activeChampionStates()) {
          if (state.doubleStrike) state.doubleStrike = createDoubleStrikeState();
          stopWujuStyleAudio(state, this.unit(state.id)!, this, 'victory');
          state.wujuStyle = null;
          stopMeditateBuff(state, this.tick, 'victory');
          stopMeditateAudio(state, this, this.unit(state.id)!, 'victory');
          state.meditate = null;
          stopHighlanderAudio(state, this.unit(state.id)!, this, 'match-end');
          state.highlander = null;
          state.alphaStrike = null;
          // Combat can finish the tick before post-combat restoration runs.
          // Canonicalize its clocks without granting HP or mana after victory.
          advanceRedBuffClock(state, this.tick);
          if (state.enlighten && state.enlighten.endTick <= this.tick) state.enlighten = null;
          finishOracleVisual(state.trinket, this.tick, 'match-end');
          this.finishGarenE(state);
          this.finishGarenW(state, 'match-end');
          stopPerseveranceVisual(state, this.unit(state.id)!, this.tick);
          cancelGarenAttack(state, this.unit(state.id)!, this.tick, 'match-end');
          cancelMasterYiAttack(state, this.unit(state.id)!, this.tick);
          finishLeonaAttack(state, this.unit(state.id)!, this.tick, 'match-end');
          finishDaybreakVisual(state, this.tick, 'match-end');
          finishGarenQPresentation(state, this.tick, 'match-end');
          this.cancelGarenRVisual(state);
          state.pendingCast = null;
          state.castAnimation = null;
          state.leonaQ = null;
          state.leonaW = null;
          finishEclipseVisual(state, this.tick, 'match-end');
          stopZenithVisual(this, this.unit(state.id)!, 'match-end');
          state.leonaEWindup = null;
          state.leonaDash = null;
          finishSolarVisual(state, this.tick, 'match-end');
          state.leonaR = null;
        }
        this.projectiles.length = 0;
        this.ahriOrbs.length = 0;
        this.ahriFoxFires.length = 0;
        this.ahriRushes.length = 0;
        this.ahriEssences.length = 0;
        this.pendingAttackProjectiles.length = 0;
        // E owns gameplay state outside the projectile list. Cancel its flight
        // and armed zone at the same terminal boundary; a burst that already
        // resolved may retain only its unexpired presentation tail.
        for (const zone of this.singularities) {
          if (zone.arrivalTick !== null) continue;
          const r = this.luxEAudio.records.find((r) => r.launch?.zoneId === zone.id);
          if (r) r.flightStopPoint = { x: zone.x, y: zone.y };
        }
        this.singularities = this.singularities.filter(
          (zone) =>
            zone.detonatedTick !== null &&
            this.tick < zone.detonatedTick + LUX_E_POLICY.presentationSeconds * TICK_RATE
        );
        advanceLuxEAudio(this);
        this.commands.length = 0;
        this.pendingSpawns.length = 0;
        for (const unit of this.units) this.setOrder(unit, { type: 'idle' });
        for (const unit of this.units) {
          unit.sunlight = null;
          unit.charm = null;
        }
        advanceOracleVisuals(this);
      }
      if (targetState) {
        if (targetState.doubleStrike) targetState.doubleStrike = createDoubleStrikeState();
        stopWujuStyleAudio(targetState, target, this, 'death');
        targetState.wujuStyle = null;
        stopMeditateBuff(targetState, this.tick, 'death');
        stopMeditateAudio(targetState, this, target, 'death');
        targetState.meditate = null;
        stopHighlanderAudio(targetState, target, this, 'death');
        targetState.highlander = null;
        targetState.alphaStrike = null;
        stopFoxFireOrbits(this, target.id);
        stopSpiritRush(this, target);
        stopEssences(this, target.id);
        this.finishGarenE(targetState);
        this.cancelGarenRVisual(targetState);
        targetState.enlighten = null;
        targetState.deaths++;
        targetState.pendingCast = null;
        for (const r of this.luxEAudio.records)
          if (r.sourceId === target.id && r.launch === null && r.stopTick === null)
            r.stopTick = this.tick;
        targetState.castAnimation = null;
        targetState.recallEnd = null;
        targetState.qStacks = 0;
        targetState.qStackExpiry = 0;
        targetState.qUntil = 0;
        targetState.garenQ = null;
        targetState.leonaQ = null;
        targetState.leonaW = null;
        finishEclipseVisual(targetState, this.tick, 'death');
        stopZenithVisual(this, target, 'death');
        targetState.leonaEWindup = null;
        targetState.leonaDash = null;
        if (targetState.leonaR) {
          if (this.tick < targetState.leonaR.releaseTick) {
            finishSolarVisual(targetState, this.tick, 'death');
            targetState.leonaR = null;
          } else {
            releaseSolarVisual(this, target, targetState);
            targetState.leonaR.released = true;
          }
        }
        finishDaybreakVisual(targetState, this.tick, 'death');
        finishGarenQPresentation(targetState, this.tick, 'death');
        this.finishGarenW(targetState, 'death');
        stopPerseveranceVisual(targetState, target, this.tick);
        targetState.garenPassiveReadyTick = 0;
      }
      for (const owner of this.activeChampionStates())
        if (owner.leonaDash?.targetId === target.id)
          this.finishLeonaDash(this.unit(owner.id)!, 'target-lost');
      target.charm = null;
      target.garenEShreds = [];
      const lastDamage = targetState?.damageContributors
        .slice()
        .reverse()
        .find((entry) => this.tick - entry.lastDamageTick <= EXECUTION_CREDIT_SECONDS * TICK_RATE);
      const credited = creditSource ?? source;
      const rewardSource =
        this.championState(credited.id) && credited.team !== target.team
          ? credited
          : lastDamage
            ? this.unit(lastDamage.creditSourceId ?? lastDamage.sourceId)
            : undefined;
      const sourceState = rewardSource ? this.championState(rewardSource.id) : undefined;
      const transferringBlue = targetState?.blueBuff && targetState.blueBuff.endTick > this.tick;
      const transferringRed = targetState?.redBuff && redBuffActive(targetState, this.tick);
      if (targetState?.redBuff && (!transferringRed || rewardSource || source.kind !== 'monster'))
        targetState.redBuff = null;
      if (targetState?.blueBuff && (!transferringBlue || rewardSource || source.kind !== 'monster'))
        targetState.blueBuff = null;
      const takedownContributors = targetState
        ? this.takedownContributors(targetState, rewardSource?.id)
        : new Set<number>();
      if (sourceState && rewardSource && rewardSource.team !== target.team) {
        if (transferringBlue || (target.kind === 'monster' && target.monster.species === 'blue'))
          grantBlueBuff(sourceState, this.tick);
        if (transferringRed || (target.kind === 'monster' && target.monster.species === 'red'))
          grantRedBuff(sourceState, this.tick);
        if (
          rewardSource.champion === 'garen' &&
          sourceState.spellRanks.w > 0 &&
          (isLaneMinionKind(target.kind) || target.kind === 'champion' || target.kind === 'monster')
        ) {
          const before = this.courageResistances(sourceState);
          sourceState.garenCourageStacks = Math.min(
            Math.ceil(GAREN_W.maxResistGain / GAREN_W.resistGainPerStack),
            sourceState.garenCourageStacks + GAREN_W.buffCounterPerKill
          );
          const gain = this.courageResistances(sourceState) - before;
          rewardSource.armor = statPrecision(rewardSource.armor + gain);
          rewardSource.magicResist = statPrecision(rewardSource.magicResist + gain);
        }
        let gold =
          target.goldBounty ??
          (target.kind === 'champion'
            ? CHAMPION_BASE_KILL_GOLD[targetState!.level - 1]
            : target.kind === 'dummy'
              ? 0
              : target.kind === 'turret'
                ? 250
                : isStructureKind(target.kind)
                  ? 0
                  : target.kind === 'siege'
                    ? 60
                    : target.kind === 'melee'
                      ? 21
                      : 14);
        if (targetState && !this.firstBloodClaimed) {
          this.firstBloodClaimed = true;
          gold += FIRST_BLOOD_BONUS;
        }
        sourceState.gold += gold;
        if (gold)
          this.emit('gold', rewardSource, {
            value: gold,
            unit: rewardSource.id,
            team: rewardSource.team,
          });
        if (target.kind === 'champion') {
          sourceState.kills++;
          highlanderTakedown(this, rewardSource, sourceState, target);
          for (const id of takedownContributors) {
            if (id === rewardSource.id) continue;
            const contributor = this.unit(id);
            const record = this.championState(id);
            if (record && contributor?.team === rewardSource.team) {
              record.assists++;
              highlanderTakedown(this, contributor, record, target);
            }
          }
        } else if (target.kind !== 'dummy' && !isStructureKind(target.kind)) {
          sourceState.cs = statPrecision(
            sourceState.cs +
              (target.kind === 'monster' ? MONSTERS[target.monster.species].minionScore : 1)
          );
          if (target.kind === 'monster') {
            this.gainExperience(target.experienceBounty ?? 0, rewardSource.id);
            if (category !== 'cleanup') companionKilledMonster(this, rewardSource, target);
          }
        }
      }
      if (target.kind !== 'monster' && isLaneMinionKind(target.kind)) {
        const radius = this.battlefield.minionExperienceRadius?.[target.team] ?? 1400;
        const recipients = this.units.filter(
          (u) =>
            u.kind === 'champion' &&
            u.team !== target.team &&
            this.alive(u) &&
            distance(u, target) <= radius
        );
        // The source table covers 1–6 recipients. Clamp sandbox overpopulation
        // to its final entry; normal five-player teams never exceed it.
        const share =
          MINION_XP_SHARES[Math.min(recipients.length, MINION_XP_SHARES.length) - 1] ?? 0;
        const amount = (target.experienceBounty ?? 60) * share;
        for (const recipient of recipients) this.gainExperience(amount, recipient.id);
      } else if (targetState) {
        const recipients = this.units.filter(
          (unit) =>
            unit.kind === 'champion' &&
            unit.team !== target.team &&
            (takedownContributors.has(unit.id) ||
              ((this.alive(unit) ||
                (unit.deadAt !== null &&
                  this.tick - unit.deadAt <= CHAMPION_KILL_XP.posthumousSeconds * TICK_RATE)) &&
                distance(unit, target) <= CHAMPION_KILL_XP.radius))
        );
        // Compute every award before XP changes anyone's level or resources.
        const awards = recipients.map((unit) => ({
          id: unit.id,
          amount: championKillExperience(
            targetState,
            this.championState(unit.id)!,
            recipients.length
          ),
        }));
        for (const award of awards) this.gainExperience(award.amount, award.id);
      }
      onEssenceDeath(this, target, rewardSource);
    }
    if (target.hp <= 0) {
      this.advanceMasterYiImpactVisuals();
      advanceSolarVisuals(this);
      advanceZenithVisuals(this);
      advanceDaybreakVisuals(this);
      advanceEclipseVisuals(this);
      advanceLeonaAttacks(this);
      advanceLeonaDeaths(this);
    }
    // Positive damage includes shield absorption. Non-champion unit sources
    // cannot trigger the mark; cleanup is not a combat hit.
    if (target.sunlight && amount > 0 && Number.isFinite(amount) && category !== 'cleanup')
      this.consumeSunlight(source, target);
    if (amount > 0) triggerScorchclaw(this, source, target, category);
  }
  gainExperience(amount: number, championId = this.player.id): void {
    const state = this.championState(championId);
    if (!state) return;
    if (this.winner || !Number.isFinite(amount) || amount <= 0 || state.level >= MAX_LEVEL) return;
    state.xp += amount;
    while (state.level < MAX_LEVEL && state.xp >= experienceToNextLevel(state.level)) {
      state.xp -= experienceToNextLevel(state.level);
      state.level++;
      state.skillPoints++;
      const factor = ASHE.growthFactors[state.level - 1];
      const h = this.unit(championId)!,
        living = this.alive(h);
      const profile = championProfile(h.champion!);
      const hp = statPrecision(profile.hpGrowth * factor),
        mana = statPrecision(profile.manaGrowth * factor);
      h.maxHp = statPrecision(h.maxHp + hp);
      h.maxMana = statPrecision(h.maxMana + mana);
      if (living) {
        h.hp = Math.min(h.maxHp, h.hp + hp);
        h.mana = Math.min(h.maxMana, h.mana + mana);
        if (state.inventory.includes('chapter'))
          state.enlighten = {
            startTick: this.tick,
            endTick: this.tick + LOST_CHAPTER.durationSeconds * TICK_RATE,
            totalMana: h.maxMana * LOST_CHAPTER.manaFraction,
          };
      }
      h.damage = statPrecision(h.damage + profile.damageGrowth * factor);
      h.armor = statPrecision(h.armor + profile.armorGrowth * factor);
      h.magicResist = statPrecision(h.magicResist + profile.magicResistGrowth * factor);
      const ratio = profile.attackSpeedRatio;
      const attackSpeed =
        profile.attackSpeed + ratio * profile.attackSpeedGrowth * growthAtLevel(state.level);
      h.attackPeriod = Math.round(TICK_RATE / attackSpeed);
      h.windupTicks =
        h.champion === 'garen'
          ? garenAttackWindupTicks(attackSpeed)
          : Math.round((profile.windupTicks * profile.attackSpeed) / attackSpeed);
      this.emit('level', h, { text: 'Level up!', unit: h.id, team: h.team });
    }
    if (state.level === MAX_LEVEL) state.xp = 0;
  }
  private respawn(u: Unit): void {
    const state = this.championState(u.id);
    if (state) {
      state.garenPassiveReadyTick = 0;
      state.garenW = null;
      state.leonaW = null;
      state.leonaEWindup = null;
      state.leonaDash = null;
      if (state.leonaR && !state.leonaR.released) state.leonaR = null;
      state.damageContributors = [];
      state.alphaMarkContributors = [];
      state.supportContributors = [];
      state.revealContributors = [];
    }
    const point =
      u.kind === 'monster'
        ? u.monster.home
        : isStructureKind(u.kind) || u.kind === 'dummy'
          ? { x: u.x, y: u.y }
          : this.battlefield.spawns[u.team];
    u.x = point.x;
    u.y = point.y;
    u.previous = { ...point };
    u.hp = u.maxHp * (u.structure?.role === 'nexus-turret' ? 0.4 : 1);
    u.mana = u.maxMana;
    u.deadAt = null;
    if (u.structureIdle) u.structureIdle.startTick = this.tick;
    u.respawnTick = null;
    u.releaseTick = null;
    u.charm = null;
    u.stunUntil = 0;
    u.rootUntil = 0;
    u.silenceUntil = 0;
    u.shields = [];
    u.scorchclawBurns = [];
    u.illumination = [];
    u.sunlight = null;
    u.garenEShreds = [];
    u.aiRetreating = false;
    u.slowUntil = 0;
    u.slows = [];
    u.slowMultiplier = 0.7;
    u.criticalSlow = null;
    this.setOrder(u, { type: 'idle' });
  }
  summonerSpell(ability: Ability, championId = this.player.id): SummonerSpell | null {
    return isSummonerSlot(ability)
      ? (this.championState(championId)?.summoners[ability] ?? null)
      : null;
  }
  summonerSlot(spell: SummonerSpell, championId = this.player.id): SummonerSlot | undefined {
    return (['d', 'f'] as const).find((slot) => this.summonerSpell(slot, championId) === spell);
  }
  abilitySpec(ability: Ability, championId = this.player.id): typeof ABILITIES.d {
    if (
      this.unit(championId)?.champion === 'masteryi' &&
      (ability === 'q' || ability === 'e' || ability === 'w' || ability === 'r')
    ) {
      const spell =
        ability === 'q'
          ? MASTER_YI_Q
          : ability === 'w'
            ? MASTER_YI_W
            : ability === 'r'
              ? MASTER_YI_R
              : MASTER_YI_E;
      return {
        name: spell.name,
        description: spell.description,
        icon: spell.icon,
        cost:
          ability === 'q'
            ? MASTER_YI_Q.manaByRank[0]
            : ability === 'w'
              ? MASTER_YI_W.manaByRank[0]
              : ability === 'r'
                ? MASTER_YI_R.manaByRank[0]
                : MASTER_YI_E.publicManaByRank[0],
        cooldown:
          ability === 'q'
            ? MASTER_YI_Q.cooldownSecondsByRank[0]
            : ability === 'w'
              ? MASTER_YI_W.publicCooldownSecondsByRank[0]
              : ability === 'r'
                ? MASTER_YI_R.cooldownSecondsByRank[0]
                : MASTER_YI_E.cooldownSecondsByRank[0],
        range: ability === 'q' ? MASTER_YI_Q.castRange : 0,
        ...(ability === 'q' ? { cantCastWhileRooted: MASTER_YI_Q.cantCastWhileRooted } : {}),
      };
    }
    if (this.unit(championId)?.champion === 'masteryi' && !isSummonerSlot(ability))
      throw new Error('Master Yi spells are not implemented');
    if (
      this.unit(championId)?.champion === 'ahri' &&
      (ability === 'q' || ability === 'w' || ability === 'e' || ability === 'r')
    ) {
      const spell =
        ability === 'q' ? AHRI_Q : ability === 'w' ? AHRI_W : ability === 'e' ? AHRI_E : AHRI_R;
      return {
        name: spell.name,
        description: spell.description,
        icon: spell.icon,
        cost: spell.manaByRank[0],
        cooldown: spell.cooldownSecondsByRank[0],
        range: spell.displayRangeByRank[0],
        ...(ability === 'r' ? { cantCastWhileRooted: AHRI_R.cantCastWhileRooted } : {}),
      };
    }
    const spell = this.summonerSpell(ability, championId);
    const companion = ownedCompanion(this, championId),
      stage = companion ? companionStage(companion.fed) : 0;
    if (spell === 'smite' && companion && stage > 0)
      return {
        ...SUMMONERS.smite,
        name: stage === 1 ? 'Unleashed Smite' : 'Primal Smite',
        icon:
          stage === 1
            ? 'S5_SummonerSmitePlayerGanker'
            : (
                {
                  gustwalker: 'SummonerSmiteAvatarUtility',
                  scorchclaw: 'SummonerSmiteAvatarOffensive',
                  mosstomper: 'SummonerSmiteAvatarDefensive',
                } as const
              )[companion.kind],
      };
    return spell ? SUMMONERS[spell] : ABILITIES[ability];
  }
  abilityCooldownTicks(ability: Ability, championId = this.player.id): number {
    const state = this.championState(championId);
    if (!state) return Infinity;
    const rush =
      ability === 'r' && this.unit(championId)?.champion === 'ahri'
        ? activeSpiritRush(this, championId)
        : undefined;
    if (rush)
      return rush.remainingCasts > 0
        ? Math.max(0, rush.nextCastTick - this.tick)
        : Math.max(0, rush.endTick - this.tick, state.cooldowns.r - this.tick);
    const chargeDeadline =
      this.summonerSpell(ability, championId) === 'smite' && state.smite?.charges === 0
        ? (state.smite.rechargeTick ?? 0)
        : ability === 'e' && state.eCharges === 0
          ? (state.eRechargeTick ?? 0)
          : 0;
    return Math.max(0, state.cooldowns[ability] - this.tick, chargeDeadline - this.tick);
  }
  spellLearningError(ability: 'q' | 'w' | 'e' | 'r', championId = this.player.id): string | null {
    if (this.winner) return 'The match has ended';
    const state = this.championState(championId);
    if (!state) return 'Unknown champion';
    const rank = state.spellRanks[ability];
    if (rank >= (ability === 'r' ? 3 : 5)) return 'This spell is already at maximum rank';
    if (state.skillPoints < 1) return 'No skill points available';
    const requiredLevel = ability === 'r' ? 6 + rank * 5 : 1 + rank * 2;
    if (state.level < requiredLevel) return `Requires champion level ${requiredLevel}`;
    return null;
  }
  private courageResistances(state: ChampionState): number {
    return state.spellRanks.w === 0
      ? 0
      : statPrecision(
          Math.min(GAREN_W.maxResistGain, state.garenCourageStacks * GAREN_W.resistGainPerStack)
        );
  }
  learnSpell(ability: 'q' | 'w' | 'e' | 'r', championId = this.player.id): string | null {
    const error = this.spellLearningError(ability, championId);
    if (error) return error;
    const state = this.championState(championId)!;
    state.skillPoints--;
    state.spellRanks[ability]++;
    const champion = this.unit(championId)!;
    if (champion.champion === 'garen' && ability === 'w' && state.spellRanks.w === 1) {
      const gain = this.courageResistances(state);
      champion.armor = statPrecision(champion.armor + gain);
      champion.magicResist = statPrecision(champion.magicResist + gain);
    }
    if (ability === 'e' && this.unit(championId)?.champion === 'ashe' && state.spellRanks.e === 1)
      state.eCharges = ASHE_E.maximumCharges;
    return null;
  }
  abilityRank(ability: Ability, championId = this.player.id): number {
    if (ability === 'd' || ability === 'f') return 1;
    return this.championState(championId)?.spellRanks[ability] ?? 0;
  }
  abilityHaste(championId = this.player.id): number {
    const owner = this.championState(championId);
    return owner ? totalAbilityHaste(owner, this.tick) : 0;
  }
  abilityResources(ability: Ability, championId = this.player.id) {
    const resources = this.baseAbilityResources(ability, championId);
    const owner = this.championState(championId);
    if (
      !owner ||
      ability === 'd' ||
      ability === 'f' ||
      (ability === 'r' &&
        this.unit(championId)?.champion === 'ahri' &&
        activeSpiritRush(this, championId))
    )
      return resources;
    return {
      ...resources,
      cooldownSeconds:
        (resources.cooldownSeconds * 100) / (100 + totalAbilityHaste(owner, this.tick)),
    };
  }
  private baseAbilityResources(ability: Ability, championId: number) {
    if (ability === 'd' || ability === 'f')
      return {
        mana: this.abilitySpec(ability, championId).cost,
        cooldownSeconds: this.abilitySpec(ability, championId).cooldown,
      };
    const rank = this.abilityRank(ability, championId);
    if (this.unit(championId)?.champion === 'masteryi') {
      return {
        mana: !rank
          ? 0
          : ability === 'q'
            ? MASTER_YI_Q.manaByRank[rank - 1]
            : ability === 'w'
              ? MASTER_YI_W.manaByRank[rank - 1]
              : ability === 'r'
                ? MASTER_YI_R.manaByRank[rank - 1]
                : MASTER_YI_E.publicManaByRank[rank - 1],
        cooldownSeconds: !rank
          ? 0
          : ability === 'q'
            ? MASTER_YI_Q.cooldownSecondsByRank[rank - 1]
            : ability === 'w'
              ? MASTER_YI_W.publicCooldownSecondsByRank[rank - 1]
              : ability === 'r'
                ? MASTER_YI_R.cooldownSecondsByRank[rank - 1]
                : MASTER_YI_E.cooldownSecondsByRank[rank - 1],
      };
    }
    if (this.unit(championId)?.champion === 'ahri') {
      if (ability === 'r' && activeSpiritRush(this, championId))
        return { mana: 0, cooldownSeconds: AHRI_R.dashCooldownSeconds };
      return {
        mana: !rank
          ? 0
          : ability === 'q'
            ? AHRI_Q.manaByRank[rank - 1]
            : ability === 'w'
              ? AHRI_W.manaByRank[rank - 1]
              : ability === 'e'
                ? AHRI_E.manaByRank[rank - 1]
                : ability === 'r'
                  ? AHRI_R.manaByRank[rank - 1]
                  : 0,
        cooldownSeconds: !rank
          ? 0
          : ability === 'q'
            ? AHRI_Q.cooldownSecondsByRank[rank - 1]
            : ability === 'w'
              ? AHRI_W.cooldownSecondsByRank[rank - 1]
              : ability === 'e'
                ? AHRI_E.cooldownSecondsByRank[rank - 1]
                : ability === 'r'
                  ? AHRI_R.cooldownSecondsByRank[rank - 1]
                  : 0,
      };
    }
    if (this.unit(championId)?.champion === 'leona')
      return rank ? leonaSpellResources(ability, rank) : { mana: 0, cooldownSeconds: 0 };
    if (this.unit(championId)?.champion === 'garen')
      return {
        mana: 0,
        cooldownSeconds: !rank
          ? 0
          : ability === 'q'
            ? GAREN_Q.cooldownSeconds
            : ability === 'w'
              ? GAREN_W.cooldownSecondsByRank[rank - 1]
              : ability === 'r'
                ? GAREN_R.cooldownSecondsByRank[rank - 1]
                : GAREN_E.cooldownSecondsByRank[rank - 1],
      };
    if (this.unit(championId)?.champion === 'lux' && ability === 'e')
      return {
        mana: rank ? LUX_E.mana[rank - 1] : 0,
        cooldownSeconds: rank ? LUX_E.cooldownSeconds[rank - 1] : 0,
      };
    if (this.unit(championId)?.champion === 'lux' && ability === 'w')
      return {
        mana: rank ? LUX_W.mana[rank - 1] : 0,
        cooldownSeconds: rank ? LUX_W.cooldownSeconds[rank - 1] : 0,
      };
    if (this.unit(championId)?.champion === 'lux' && ability === 'r')
      return {
        mana: rank ? LUX_R.mana : 0,
        cooldownSeconds: rank ? LUX_R.cooldownSeconds[rank - 1] : 0,
      };
    if (this.unit(championId)?.champion === 'lux')
      return {
        mana: ability === 'q' && rank ? LUX_BINDING.mana : 0,
        cooldownSeconds: ability === 'q' && rank ? LUX_BINDING.cooldownSeconds : 0,
      };
    return rank ? asheSpellResources(ability, rank) : { mana: 0, cooldownSeconds: 0 };
  }
  private cast(u: Unit, ability: Ability, point: Vec2, targetId?: number): void {
    const state = this.championState(u.id);
    if (!state || u.kind !== 'champion') return;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    if (
      activeSpiritDash(this, u.id) &&
      this.summonerSpell(ability, u.id) !== 'heal' &&
      this.summonerSpell(ability, u.id) !== 'flash'
    )
      return;
    const summoner = this.summonerSpell(ability, u.id);
    if (summoner === 'smite') {
      const target = targetId === undefined ? undefined : this.unit(targetId);
      if (
        !state.smite ||
        state.smite.charges === 0 ||
        this.abilityCooldownTicks(ability, u.id) > 0 ||
        !smiteTarget(this, u, target)
      )
        return;
      state.smite.charges--;
      if (state.smite.rechargeTick === null)
        state.smite.rechargeTick = this.tick + SUMMONER_SMITE.rechargeSeconds * TICK_RATE;
      state.cooldowns[ability] = this.tick + SUMMONER_SMITE.cooldownSeconds * TICK_RATE;
      this.emit('cast', u, { unit: u.id, champion: u.champion, text: ability, team: u.team });
      const pet = ownedCompanion(this, u.id),
        stage = pet ? companionStage(pet.fed) : 0,
        damage = pet ? companionSmiteDamage(pet.fed) : SUMMONER_SMITE.baseDamage;
      companionSmitePose(this, u);
      if (target.kind === 'champion') {
        this.damage(u, target, COMPANION_SOURCE.championSmiteDamage, 'true', 'summoner');
        this.applySlow(
          u,
          target,
          'smite',
          COMPANION_SOURCE.championSmiteSlowSeconds * TICK_RATE,
          1 - COMPANION_SOURCE.championSmiteSlow
        );
      } else if (stage === 2 && target.kind === 'monster') {
        const victims = this.units.filter(
          (v) =>
            v.kind === 'monster' &&
            this.alive(v) &&
            distance(v, target) <= COMPANION_SOURCE.finalSmiteRadius
        );
        for (const victim of victims) this.damage(u, victim, damage, 'true', 'summoner');
      } else this.damage(u, target, damage, 'true', 'summoner');
      return;
    }
    if (
      targetId !== undefined &&
      !(
        (u.champion === 'garen' && ability === 'r') ||
        (u.champion === 'masteryi' && ability === 'q')
      )
    )
      return;
    // Check before Lux's E-recast shortcut as well as ordinary casts.
    if (u.silenceUntil > this.tick && !this.abilitySpec(ability, u.id).canCastWhileSilenced) {
      this.emit('message', u, { text: 'Cannot cast while silenced', unit: u.id, team: u.team });
      return;
    }
    if (u.champion === 'garen' && ability === 'e' && state.garenE) {
      if (this.tick >= state.garenE.startTick + GAREN_E_RECAST_TICKS) this.finishGarenE(state);
      return;
    }
    if (u.champion === 'lux' && ability === 'e') {
      if (state.pendingCast?.ability === 'e') {
        state.pendingCast.detonateRequested = true;
        return;
      }
      const active = this.singularities.find(
        (z) => z.sourceId === u.id && z.detonatedTick === null
      );
      if (active) {
        active.detonateRequested = true;
        return;
      }
    }
    const flashDuringFinalSpark =
      summoner === 'flash' && u.champion === 'lux' && state.pendingCast?.ability === 'r';
    if (state.pendingCast && summoner !== 'heal' && !flashDuringFinalSpark) return;
    const spec = this.abilitySpec(ability, u.id);
    const fail = (text: string) => this.emit('message', u, { text, unit: u.id, team: u.team });
    if (
      u.rootUntil > this.tick &&
      (spec.cantCastWhileRooted ||
        (u.champion === 'leona' && ability === 'e' && LEONA_SPELLS.e.cantCastWhileRooted))
    ) {
      fail('Cannot cast that spell while rooted');
      return;
    }
    if (!this.abilityRank(ability, u.id)) {
      fail('Learn that spell first');
      return;
    }
    const resources = this.abilityResources(ability, u.id);
    if (
      this.abilityCooldownTicks(ability, u.id) > 0 ||
      (u.champion === 'ashe' && ability === 'e' && state.eCharges === 0)
    ) {
      fail('That spell is not ready yet');
      return;
    }
    if (u.mana < resources.mana) {
      fail('Not enough mana');
      return;
    }
    if (u.champion === 'ashe' && ability === 'q' && state.qStacks < 4) {
      fail('Build 4 Focus with basic attacks');
      return;
    }
    if (u.champion === 'masteryi' && ability === 'q') {
      const target = targetId === undefined ? undefined : this.unit(targetId);
      if (!alphaTarget(this, u, target) || distance(u, target) > MASTER_YI_Q.castRange) {
        fail('Choose a visible enemy in Alpha Strike range');
        return;
      }
      this.setOrder(u, { type: 'idle' });
      u.mana -= resources.mana;
      state.cooldowns.q = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      beginAlphaStrike(state, u, target, this.tick);
      beginAlphaAudio(this, u, target);
      captureAlphaCast(this, u);
      this.emit('cast', u, { unit: u.id, champion: 'masteryi', text: 'q', team: u.team });
      return;
    }
    if (u.champion === 'masteryi' && ability === 'r') {
      stopHighlanderAudio(state, u, this, 'recast');
      u.slowUntil = 0;
      u.slowMultiplier = 1;
      u.criticalSlow = null;
      u.slows = [];
      state.highlander = {
        startTick: this.tick,
        endTick: this.tick + HIGHLANDER_TICKS,
        rank: state.spellRanks.r,
        pausedTicks: 0,
        extensionCount: 0,
        takedownsAtCast: state.kills + state.assists,
        lastExtensionTick: null,
      };
      beginHighlanderAudio(state, u, this);
      captureSwordGlow(this, u, 1);
      captureHighlanderCast(this, u);
      u.mana -= resources.mana;
      state.cooldowns.r = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      this.emit('cast', u, { unit: u.id, champion: 'masteryi', text: 'r', team: u.team });
      return;
    }
    if (u.champion === 'masteryi' && ability === 'w') {
      this.setOrder(u, { type: 'idle' });
      u.nextAttackTick = this.tick;
      u.mana -= resources.mana;
      state.cooldowns.w = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      beginMeditate(state, this.tick, state.spellRanks.w, this.abilityPower(u));
      captureMeditateCast(this, u);
      captureMeditateBuff(this, u);
      beginMeditateAudio(this, u);
      this.emit('cast', u, { unit: u.id, champion: 'masteryi', text: 'w', team: u.team });
      return;
    }
    if (u.champion === 'masteryi' && ability === 'e') {
      stopWujuStyleAudio(state, u, this, 'recast');
      state.wujuStyle = {
        startTick: this.tick,
        endTick: this.tick + WUJU_STYLE_TICKS,
        rank: state.spellRanks.e,
        pausedTicks: 0,
      };
      beginWujuStyleAudio(state, u, this);
      captureSwordGlow(this, u, 0);
      state.cooldowns.e = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      this.emit('cast', u, { unit: u.id, champion: 'masteryi', text: 'e', team: u.team });
      return;
    }
    if (u.champion === 'ahri' && ability === 'r') {
      const destination = spiritRushDestination(this, u, point);
      if (!destination) return;
      const existing = activeSpiritRush(this, u.id);
      if (existing && existing.remainingCasts === 0) return;
      const rank = state.spellRanks.r,
        damage = spiritRushDamage(rank, this.abilityPower(u));
      beginSpiritRush(this, u, rank, damage, destination);
      u.mana -= resources.mana;
      if (!existing)
        state.cooldowns.r = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.castAnimation = { ability: 'r', startTick: this.tick };
      this.finishAttackPresentation(u, 'action');
      u.releaseTick = null;
      u.attackTarget = null;
      u.attackCycle = null;
      const dir = direction(u, destination);
      u.facing = Math.atan2(dir.x, dir.y);
      this.emit('cast', u, { unit: u.id, champion: 'ahri', text: 'r', team: u.team });
      return;
    }
    if (u.champion === 'ahri' && ability === 'q') {
      const dir = direction(u, point);
      if (!dir.x && !dir.y) return;
      const rank = state.spellRanks.q,
        power = this.abilityPower(u);
      ahriOrbDamage(rank, power);
      u.mana -= resources.mana;
      state.cooldowns.q = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.pendingCast = {
        ability: 'q',
        rank,
        startTick: this.tick,
        releaseTick: this.tick + Math.round(AHRI_Q.castSeconds * TICK_RATE),
        point: { x: point.x, y: point.y },
        damage: ahriOrbDamage(rank, power),
      };
      state.castAnimation = { ability: 'q', startTick: this.tick };
      this.finishAttackPresentation(u, 'action');
      u.releaseTick = null;
      u.attackTarget = null;
      u.attackCycle = null;
      u.facing = Math.atan2(dir.x, dir.y);
      this.emit('cast', u, { unit: u.id, champion: 'ahri', text: 'q', team: u.team });
      return;
    }
    if (u.champion === 'ahri' && ability === 'e') {
      const dir = direction(u, point);
      if (!dir.x && !dir.y) return;
      const rank = state.spellRanks.e,
        damage = AHRI_E.damageByRank[rank - 1] + AHRI_E.abilityPowerRatio * this.abilityPower(u);
      u.mana -= resources.mana;
      state.cooldowns.e = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.pendingCast = {
        ability: 'e',
        rank,
        startTick: this.tick,
        releaseTick: this.tick + AHRI_E_POLICY.windupTicks,
        point: { x: point.x, y: point.y },
        damage,
      };
      state.castAnimation = { ability: 'e', startTick: this.tick };
      this.finishAttackPresentation(u, 'action');
      u.releaseTick = null;
      u.attackTarget = null;
      u.attackCycle = null;
      u.facing = Math.atan2(dir.x, dir.y);
      this.emit('cast', u, { unit: u.id, champion: 'ahri', text: 'e', team: u.team });
      return;
    }
    if (u.champion === 'ahri' && ability === 'w') {
      const rank = state.spellRanks.w,
        damage = foxFireDamage(rank, this.abilityPower(u));
      beginFoxFireCast(this, u, rank, damage);
      u.mana -= resources.mana;
      state.cooldowns.w = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.pendingCast = {
        ability: 'w',
        rank,
        startTick: this.tick,
        releaseTick: this.tick + AHRI_W_POLICY.windupTicks,
        point: { x: u.x, y: u.y },
        damage,
      };
      state.castAnimation = { ability: 'w', startTick: this.tick };
      this.finishAttackPresentation(u, 'action');
      u.releaseTick = null;
      u.attackTarget = null;
      u.attackCycle = null;
      this.emit('cast', u, { unit: u.id, champion: 'ahri', text: 'w', team: u.team });
      return;
    }
    if (u.champion === 'leona' && ability === 'r') {
      if (state.leonaR || state.leonaEWindup || this.committedLeonaQ(u)) return;
      const dir = direction(u, point),
        reach = Math.min(distance(u, point), LEONA_SPELLS.r.castRange);
      state.leonaR = {
        startTick: this.tick,
        releaseTick: this.tick + LEONA_COMBAT_POLICY.solarWindupTicks,
        impactTick: this.tick + LEONA_COMBAT_POLICY.solarImpactTicks,
        released: false,
        rank: state.spellRanks.r,
        origin: { x: u.x, y: u.y },
        point: { x: u.x + dir.x * reach, y: u.y + dir.y * reach },
        damage: leonaSolarFlareValues(state.spellRanks.r, this.abilityPower(u)).magicDamage,
      };
      u.mana -= resources.mana;
      state.cooldowns.r = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.castAnimation = { ability: 'r', startTick: this.tick };
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      if (dir.x || dir.y) u.facing = Math.atan2(dir.x, dir.y);
      beginSolarVisual(this, u, state);
      this.emit('cast', u, { unit: u.id, champion: 'leona', text: 'r', team: u.team });
      return;
    }
    if (u.champion === 'leona' && ability === 'e') {
      const dir = direction(u, point);
      if (
        (!dir.x && !dir.y) ||
        this.committedLeonaQ(u) ||
        state.leonaEWindup ||
        (state.leonaR && !state.leonaR.released) ||
        state.leonaDash ||
        this.projectiles.some((p) => p.type === 'zenith' && p.source === u.id)
      )
        return;
      state.leonaEWindup = {
        startTick: this.tick,
        releaseTick: this.tick + LEONA_COMBAT_POLICY.zenithWindupTicks,
        rank: state.spellRanks.e,
        origin: { x: u.x, y: u.y },
        direction: dir,
        damage: leonaZenithValues(state.spellRanks.e, this.abilityPower(u)).magicDamage,
      };
      u.mana -= resources.mana;
      state.cooldowns.e = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.castAnimation = { ability: 'e', startTick: this.tick };
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      u.facing = Math.atan2(dir.x, dir.y);
      beginZenithVisual(this, u, state);
      this.emit('cast', u, { unit: u.id, champion: 'leona', text: 'e', team: u.team });
      return;
    }
    if (u.champion === 'leona' && ability === 'w') {
      const detonationTick = this.tick + LEONA_COMBAT_POLICY.eclipseDurationTicks;
      beginEclipseVisual(this, u, state);
      state.leonaW = {
        startTick: this.tick,
        rank: state.spellRanks.w,
        detonationTick,
        endTick: detonationTick,
        detonated: false,
      };
      u.mana -= resources.mana;
      state.cooldowns.w = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      if (
        !state.leonaEWindup &&
        !(state.leonaR && !state.leonaR.released) &&
        !state.leonaDash &&
        u.releaseTick === null
      )
        state.castAnimation = { ability: 'w', startTick: this.tick };
      this.emit('cast', u, { unit: u.id, champion: 'leona', text: 'w', team: u.team });
      return;
    }
    if (u.champion === 'leona' && ability === 'q') {
      if (this.committedLeonaQ(u)) return;
      beginDaybreakVisual(this, u, state);
      state.leonaQ = {
        startTick: this.tick,
        rank: state.spellRanks.q,
        endTick: this.tick + LEONA_COMBAT_POLICY.attackWindowTicks,
      };
      u.mana -= resources.mana;
      state.cooldowns.q = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      if (!state.leonaEWindup && !(state.leonaR && !state.leonaR.released))
        state.castAnimation = null;
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      u.nextAttackTick = this.tick;
      this.emit('cast', u, { unit: u.id, champion: 'leona', text: 'q', team: u.team });
      return;
    }
    if (u.champion === 'garen' && ability === 'e') {
      if (u.releaseTick !== null && u.attackCycle?.garenQRank !== undefined) return;
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      state.castAnimation = null;
      state.recallEnd = null;
      state.garenE = {
        startTick: this.tick,
        endTick: this.tick + GAREN_E_DURATION_TICKS,
        rank: state.spellRanks.e,
        strikes: garenEStrikes(state.level),
        completedStrikes: 0,
        cooldownTicks: hastedCooldownTicks(
          GAREN_E.cooldownSecondsByRank[state.spellRanks.e - 1],
          totalAbilityHaste(state, this.tick)
        ),
        hits: [],
      };
      state.garenEVisual = { startTick: this.tick, stopTick: null, facing: u.facing };
      this.emit('cast', u, { unit: u.id, champion: 'garen', text: 'e', team: u.team });
      return;
    }
    if (u.champion === 'garen' && ability === 'r') {
      const target = targetId === undefined ? undefined : this.unit(targetId);
      if (
        !target ||
        target.kind !== 'champion' ||
        !this.validTarget(u, target) ||
        distance(u, target) > GAREN_R.castRange ||
        (u.attackCycle?.garenQRank !== undefined && u.releaseTick !== null)
      )
        return;
      this.finishGarenE(state);
      state.recallEnd = null;
      state.cooldowns.r = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      u.facing = Math.atan2(target.x - u.x, target.y - u.y);
      state.garenRReveal = {
        targetId: target.id,
        startTick: this.tick,
        endTick: this.tick + GAREN_R_REVEAL_TICKS,
      };
      state.garenRVisual = {
        startTick: this.tick,
        targetId: target.id,
        facing: u.facing,
        point: { x: target.x, y: target.y },
        releaseTick: null,
        stopTick: null,
        killed: false,
      };
      state.castAnimation = { ability: 'r', startTick: this.tick };
      state.pendingCast = {
        ability: 'r',
        rank: state.spellRanks.r,
        targetId: target.id,
        startTick: this.tick,
        releaseTick: this.tick + GAREN_R_WINDUP_TICKS,
        point: { x: target.x, y: target.y },
        damage: 0,
      };
      this.emit('cast', u, { unit: u.id, champion: 'garen', text: 'r', team: u.team });
      return;
    }
    if (u.champion === 'garen' && ability === 'w') {
      const rank = state.spellRanks.w;
      const upfrontTicks = Math.round(GAREN_W.upfrontSeconds * TICK_RATE);
      state.garenW = {
        startTick: this.tick,
        rank,
        upfrontUntil: this.tick + upfrontTicks,
        defenseUntil: this.tick + Math.round(GAREN_W.damageReductionSeconds * TICK_RATE),
      };
      state.garenWVisual = { startTick: this.tick, stopTick: null, endReason: null };
      const baseHealth = GAREN.hp + GAREN.hpGrowth * growthAtLevel(state.level);
      const bonusHealth = Math.max(0, u.maxHp - baseHealth);
      this.applyShield(
        u,
        u,
        GAREN_W.baseShieldByRank[rank - 1] + GAREN_W.bonusHealthShieldRatio * bonusHealth,
        upfrontTicks
      );
      state.cooldowns.w = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      this.emit('cast', u, { unit: u.id, champion: 'garen', text: 'w', team: u.team });
      return;
    }
    if (u.champion === 'garen' && ability === 'q') {
      finishGarenQPresentation(state, this.tick, 'recast');
      state.garenQVisuals.push({
        startTick: this.tick,
        rank: state.spellRanks.q,
        stopTick: null,
        endReason: null,
        attacks: [],
      });
      state.garenQ = {
        startTick: this.tick,
        rank: state.spellRanks.q,
        attackUntil: this.tick + Math.round(GAREN_Q.attackWindowSeconds * TICK_RATE),
        speedUntil:
          this.tick + Math.round(GAREN_Q.movementSecondsByRank[state.spellRanks.q - 1] * TICK_RATE),
        consumed: false,
      };
      state.cooldowns.q = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      state.castAnimation = null;
      u.slowUntil = 0;
      u.slowMultiplier = 1;
      u.criticalSlow = null;
      u.slows = [];
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'recast');
      u.attackCycle = null;
      u.nextAttackTick = this.tick;
      this.emit('cast', u, { unit: u.id, champion: 'garen', text: 'q', team: u.team });
      return;
    }
    const dir = direction(u, point);
    if (
      u.champion === 'lux' &&
      (ability === 'q' || ability === 'w' || ability === 'e' || ability === 'r')
    ) {
      if (!dir.x && !dir.y && ability !== 'e') return;
      u.mana -= resources.mana;
      state.cooldowns[ability] = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
      state.recallEnd = null;
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      u.facing = Math.atan2(dir.x, dir.y);
      const spell = ability === 'q' ? LUX_BINDING : ability === 'e' ? LUX_E : LUX_R;
      const shield =
        LUX_W.baseShield[state.spellRanks.w - 1] + LUX_W.abilityPowerRatio * this.abilityPower(u);
      if (ability === 'w') this.applyPrismaticShield(u, u, shield, this.tick);
      state.castAnimation = { ability, startTick: this.tick };
      state.pendingCast = {
        ...(ability === 'r' ? { origin: { x: u.x, y: u.y } } : {}),
        ability,
        rank: state.spellRanks[ability],
        startTick: this.tick,
        releaseTick:
          this.tick + (ability === 'w' ? LUX_W.castSeconds : spell.castSeconds) * TICK_RATE,
        ...(ability === 'w' ? { shield } : {}),
        ...(ability === 'e' ? { detonateRequested: false } : {}),
        point:
          ability === 'r'
            ? { x: u.x + dir.x * LUX_R.range, y: u.y + dir.y * LUX_R.range }
            : ability === 'e'
              ? {
                  x: u.x + dir.x * Math.min(distance(u, point), LUX_E.castRange),
                  y: u.y + dir.y * Math.min(distance(u, point), LUX_E.castRange),
                }
              : { x: point.x, y: point.y },
        damage:
          ability === 'w'
            ? 0
            : spell.baseDamage[state.spellRanks[ability] - 1] +
              spell.abilityPowerRatio * this.abilityPower(u),
      };
      if (ability === 'e')
        this.luxEAudio.records.push({
          sourceId: u.id,
          team: u.team as Team,
          startTick: this.tick,
          point: { x: u.x, y: u.y },
          aim: { ...state.pendingCast.point },
          castOrdinal: this.luxEAudio.counts.cast++,
          launch: null,
          arrival: null,
          hit: null,
          stopTick: null,
          flightStopPoint: null,
        });
      this.emit('cast', u, { unit: u.id, champion: u.champion, text: ability, team: u.team });
      return;
    }
    if ((ability === 'w' || ability === 'r' || summoner === 'flash') && dir.x === 0 && dir.y === 0)
      return;
    u.mana -= resources.mana;
    state.cooldowns[ability] = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
    if (!spec.preservesRecall) state.recallEnd = null;
    if (
      summoner !== 'heal' &&
      !flashDuringFinalSpark &&
      !(summoner === 'flash' && (state.leonaEWindup || (state.leonaR && !state.leonaR.released)))
    )
      state.castAnimation = null;
    this.emit('cast', u, { unit: u.id, champion: u.champion, text: ability, team: u.team });
    if (ability === 'q') {
      state.qStacks = 0;
      state.qStackExpiry = 0;
      state.qUntil = this.tick + ASHE_Q.durationSeconds * TICK_RATE;
      if (ASHE_Q.resetsAttackTimer) {
        // Cancel an unreleased attack or its recovery, retaining the current
        // order/path. advanceUnit may start an empowered attack this tick.
        u.releaseTick = null;
        u.attackTarget = null;
        this.finishAttackPresentation(u, 'action');
        u.attackCycle = null;
        u.nextAttackTick = this.tick;
      }
    }
    if (ability === 'w' || ability === 'e' || ability === 'r') {
      const timing = ASHE_CASTS[ability];
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      this.finishAttackPresentation(u, 'action');
      u.attackCycle = null;
      u.facing = Math.atan2(dir.x, dir.y);
      state.castAnimation = { ability, startTick: this.tick };
      state.pendingCast = {
        ability,
        rank: state.spellRanks[ability],
        startTick: this.tick,
        releaseTick: this.tick + timing.castSeconds * TICK_RATE,
        point: { ...point },
        damage:
          ability === 'e' ? 0 : ability === 'r' ? this.crystalArrowDamage(u) : this.volleyDamage(u),
      };
    }
    if (ability === 'e') {
      state.eCharges--;
      if (state.eRechargeTick === null) {
        state.eRechargeDurationTicks = hastedCooldownTicks(
          asheHawkshotValues(state.spellRanks.e).rechargeSeconds,
          totalAbilityHaste(state, this.tick)
        );
        state.eRechargeTick = this.tick + state.eRechargeDurationTicks;
      }
    }
    if (summoner === 'flash') {
      stopSpiritDash(this, u, 'flash');
      stopZenithDashVisual(this, u, 'flash');
      state.leonaDash = null;
      const d = Math.min(spec.range, distance(u, point));
      const end = this.battlefield.reachable(
        { x: u.x + dir.x * d, y: u.y + dir.y * d },
        u.radius,
        u.team
      );
      u.x = end.x;
      u.y = end.y;
      u.previous = { ...end };
      this.setOrder(u, { type: 'idle' });
    }
    if (summoner === 'heal') {
      const allies = this.units.filter(
        (ally) =>
          ally.id !== u.id &&
          ally.team === u.team &&
          ally.kind === 'champion' &&
          this.alive(ally) &&
          distance(u, ally) <= SUMMONER_HEAL.allyRange
      );
      // Cursor preference and lowest-health fallback; see docs/SUMMONER-HEAL.md.
      const underCursor = (point.x === u.x && point.y === u.y ? [] : allies)
        .filter((ally) => distance(ally, point) <= SUMMONER_HEAL.cursorForgiveness)
        .sort((a, b) => distance(a, point) - distance(b, point) || a.id - b.id)[0];
      const ally =
        underCursor ??
        allies.sort(
          (a, b) =>
            a.hp / a.maxHp - b.hp / b.maxHp || distance(u, a) - distance(u, b) || a.id - b.id
        )[0];
      for (const recipient of ally ? [u, ally] : [u]) {
        const amount = Math.min(
          this.summonerHealAmount(u, recipient),
          recipient.maxHp - recipient.hp
        );
        recipient.hp += amount;
        recipient.summonerHealReductionUntil =
          this.tick + SUMMONER_HEAL.repeatHealWindowSeconds * TICK_RATE;
        recipient.summonerHealSpeedUntil =
          this.tick + SUMMONER_HEAL.speedDurationSeconds * TICK_RATE;
        if (recipient.id !== u.id) {
          const supporters = this.championState(recipient.id)!.supportContributors;
          const entry = supporters.find((entry) => entry.sourceId === u.id);
          if (entry) entry.lastSupportTick = this.tick;
          else supporters.push({ sourceId: u.id, lastSupportTick: this.tick });
        }
        this.emit('heal', recipient, { value: Math.round(amount) });
      }
    }
  }
  private releaseHawkshot(u: Unit, point: Vec2): void {
    const dir = direction(u, point);
    this.projectiles.push({
      id: this.nextId++,
      source: u.id,
      team: u.team,
      type: 'hawkshot',
      launchTick: this.tick,
      origin: { x: u.x, y: u.y },
      x: u.x,
      y: u.y,
      previous: { x: u.x, y: u.y },
      direction: dir,
      target: null,
      damage: 0,
      speed: ASHE_E.projectileSpeed,
      radius: 0,
      remaining: Math.min(ASHE_E.range, distance(u, point)),
      volleyId: null,
    });
  }
  private releaseArrowSpell(
    u: Unit,
    ability: 'w' | 'r',
    point: Vec2,
    capturedDamage?: number,
    capturedRank?: number
  ): void {
    const dir = direction(u, point),
      spec = ABILITIES[ability];
    const volleyId = ability === 'w' ? this.nextId++ : null;
    const number =
        ability === 'w'
          ? asheVolleyValues(capturedRank ?? this.abilityRank('w', u.id), 0).arrows
          : 1,
      angle = Math.atan2(dir.y, dir.x);
    if (volleyId !== null) this.volleyHits[volleyId] = [];
    for (let i = 0; i < number; i++) {
      const a = angle + (number === 1 ? 0 : (i / (number - 1) - 0.5) * 0.8);
      this.projectiles.push({
        id: this.nextId++,
        x: u.x,
        y: u.y,
        previous: { x: u.x, y: u.y },
        source: u.id,
        team: u.team,
        type: ability === 'w' ? 'volley' : 'ultimate',
        target: null,
        direction: { x: Math.cos(a), y: Math.sin(a) },
        damage:
          capturedDamage ?? (ability === 'w' ? this.volleyDamage(u) : this.crystalArrowDamage(u)),
        speed: ability === 'w' ? ASHE_W.projectileSpeed : ASHE_R.initialSpeed,
        radius: ability === 'w' ? 12 : CRYSTAL_ARROW_RADIUS,
        remaining: spec.range,
        volleyId,
      });
    }
  }
  purchasePlan(
    itemId: string,
    championId = this.player.id
  ): { cost: number; consumed: number[] } | null {
    const state = this.championState(championId);
    const item = ITEMS.find((entry) => entry.id === itemId);
    if (!state || !item) return null;
    const consumed: number[] = [];
    let cost: number = item.price;
    for (const component of ITEM_RECIPES[itemId] ?? []) {
      const slot = state.inventory.findIndex(
        (id, index) => id === component && !consumed.includes(index)
      );
      if (slot < 0) continue;
      consumed.push(slot);
      cost -= ITEMS.find((entry) => entry.id === component)!.price;
    }
    return { cost, consumed };
  }
  purchaseError(itemId: string, championId = this.player.id): string | null {
    if (this.winner) return 'The game has ended';
    const state = this.championState(championId);
    const champion = this.unit(championId);
    if (!state || !champion || champion.kind !== 'champion') return 'Unknown champion';
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return 'Unknown item';
    if (distance(champion, this.battlefield.spawns[champion.team]) > 400 && champion.hp > 0)
      return 'Return to your fountain to purchase items';
    const plan = this.purchasePlan(itemId, championId)!;
    const kind = companionItemKind(itemId),
      pet = ownedCompanion(this, championId);
    if (kind) {
      if (!this.summonerSlot('smite', championId)) return 'Requires Smite';
      if (pet || state.inventory.some((id) => id !== null && companionItemKind(id)))
        return 'You already own a jungle companion';
      if (state.inventory.some(isDoranStarter)) return 'You already own a Doran item';
    } else {
      if (this.summonerSlot('smite', championId) && !pet) return 'Buy a jungle companion first';
      if (isDoranStarter(itemId) && pet)
        return 'Your jungle companion occupies the starter item group';
    }
    const emptySlot = state.inventory.findIndex(
      (id, slot) => id === null || plan.consumed.includes(slot)
    );
    if (emptySlot === -1 && state.inventory.length >= 6) return 'Inventory is full';
    if (state.gold < plan.cost) return 'Not enough gold';
    if (item.id === 'deathcap' && state.inventory.includes('deathcap'))
      return 'You already own Rabadon’s Deathcap';
    if (item.id === 'infinity-edge' && state.inventory.includes('infinity-edge'))
      return 'You already own Infinity Edge';
    if (item.id === 'boots' && state.inventory.includes('boots')) return 'You already own boots';
    if (item.id === 'chapter' && state.inventory.includes('chapter'))
      return 'You already own Lost Chapter';
    if (item.id === 'blade' && state.inventory.includes('blade'))
      return 'You already own a Doran item';
    return null;
  }
  abilityPower(u: Unit = this.hero): number {
    const inventory = this.championState(u.id)?.inventory ?? [];
    const flat = inventory.reduce<number>(
      (total, id) => total + (ITEMS.find((item) => item.id === id)?.abilityPower ?? 0),
      0
    );
    return statPrecision(
      flat * (inventory.includes('deathcap') ? 1 + DEATHCAP_AP_AMPLIFICATION : 1)
    );
  }
  criticalChance(u: Unit = this.hero): number {
    const inventory = this.championState(u.id)?.inventory ?? [];
    return Math.min(
      1,
      statPrecision(
        inventory.reduce<number>((sum, id) => {
          const item = ITEMS.find((entry) => entry.id === id);
          return sum + (item && 'criticalChance' in item ? item.criticalChance : 0);
        }, 0)
      )
    );
  }
  /** Modifier for a non-structure attack; excludes on-hit and ability damage. */
  basicAttackDamageMultiplier(u: Unit = this.hero, critical = false): number {
    const inventory = this.championState(u.id)?.inventory ?? [];
    const bonus = statPrecision(
      inventory.reduce<number>((sum, id) => {
        const item = ITEMS.find((entry) => entry.id === id);
        return sum + (item && 'bonusCriticalDamage' in item ? item.bonusCriticalDamage : 0);
      }, 0)
    );
    if (u.champion === 'ashe')
      return statPrecision(
        CRITICAL_ATTACKS.asheBaseMultiplier +
          this.criticalChance(u) * (CRITICAL_ATTACKS.asheChanceCoefficient + bonus)
      );
    return critical ? CRITICAL_ATTACKS.ordinaryMultiplier + bonus : 1;
  }

  crystalArrowDamage(u: Unit = this.hero, rank = this.abilityRank('r', u.id)): number {
    return asheCrystalArrowValues(rank, this.abilityPower(u)).damage;
  }
  /** Healing before missing-health cap; optional recipient applies its recent-Heal penalty. */
  summonerHealAmount(caster: Unit = this.hero, recipient?: Unit): number {
    const levelFraction = Math.max(
      0,
      Math.min(1, ((this.championState(caster.id)?.level ?? 1) - 1) / 17)
    );
    const base =
      SUMMONER_HEAL.minimumHeal +
      (SUMMONER_HEAL.maximumHeal - SUMMONER_HEAL.minimumHeal) * levelFraction;
    return (
      base *
      (recipient && recipient.summonerHealReductionUntil > this.tick
        ? SUMMONER_HEAL.repeatHealMultiplier
        : 1)
    );
  }
  /** Raw Volley damage; cast snapshots retain this value at windup. */
  volleyDamage(u: Unit = this.hero, rank = this.abilityRank('w', u.id)): number {
    return asheVolleyValues(
      rank,
      u.damage -
        ASHE.damage -
        ASHE.damageGrowth * growthAtLevel(this.championState(u.id)?.level ?? 1)
    ).damage;
  }
  buy(itemId: string, championId = this.player.id): string | null {
    const error = this.purchaseError(itemId, championId);
    if (error) return error;
    const state = this.championState(championId)!;
    const champion = this.unit(championId)!;
    const item = ITEMS.find((entry) => entry.id === itemId)!;
    const plan = this.purchasePlan(itemId, championId)!;
    const emptySlot = state.inventory.findIndex(
      (id, slot) => id === null || plan.consumed.includes(slot)
    );
    state.gold -= plan.cost;
    let armor: number = item.armor,
      magicResist: number = item.magicResist,
      damage: number = item.damage,
      hp: number = item.hp,
      mana: number = 'mana' in item ? item.mana : 0,
      speed: number = item.speed;
    for (const slot of plan.consumed) {
      const component = ITEMS.find((entry) => entry.id === state.inventory[slot])!;
      armor -= component.armor;
      magicResist -= component.magicResist;
      damage -= component.damage;
      hp -= component.hp;
      mana -= 'mana' in component ? component.mana : 0;
      speed -= component.speed;
      state.inventory[slot] = null;
    }
    if (emptySlot === -1) state.inventory.push(item.id);
    else state.inventory[emptySlot] = item.id;
    champion.armor += armor;
    champion.magicResist += magicResist;
    champion.damage += damage;
    champion.maxHp += hp;
    if (this.alive(champion)) champion.hp += hp;
    this.changeItemMana(champion, mana);
    champion.speed += speed;
    const kind = companionItemKind(itemId);
    if (kind) grantCompanion(this, kind, championId, { kind: 'purchase', consumedTick: null });
    return null;
  }
  /** Local item policy: preserve missing mana, clamp at zero, and do not refill dead owners. */
  private changeItemMana(champion: Unit, delta: number): void {
    champion.maxMana = statPrecision(champion.maxMana + delta);
    champion.mana = Math.min(
      champion.maxMana,
      Math.max(0, champion.mana + (this.alive(champion) ? delta : 0))
    );
  }
  moveItem(from: number, to: number, championId = this.player.id): string | null {
    if (this.winner) return 'The game has ended';
    const owner = this.championState(championId);
    if (!owner) return 'Unknown champion';
    if (![from, to].every((slot) => Number.isInteger(slot) && slot >= 0 && slot < 6))
      return 'Invalid inventory slot';
    if (!owner.inventory[from]) return 'Choose an owned item';
    if (from === to) return null;
    while (owner.inventory.length <= Math.max(from, to)) owner.inventory.push(null);
    [owner.inventory[from], owner.inventory[to]] = [owner.inventory[to], owner.inventory[from]];
    while (owner.inventory.length && owner.inventory.at(-1) === null) owner.inventory.pop();
    return null;
  }
  sell(slot: number, championId = this.player.id): string | null {
    if (this.winner) return 'The game has ended';
    const state = this.championState(championId);
    const champion = this.unit(championId);
    if (!state || !champion || champion.kind !== 'champion') return 'Unknown champion';
    if (!Number.isInteger(slot) || slot < 0 || slot >= state.inventory.length)
      return 'Choose an owned item';
    if (distance(champion, this.battlefield.spawns[champion.team]) > 400 && this.alive(champion))
      return 'Return to your fountain to sell items';
    const item = ITEMS.find((entry) => entry.id === state.inventory[slot]);
    if (!item) return 'Unknown item';
    if (companionItemKind(item.id)) return 'Jungle companions cannot be sold';
    state.inventory[slot] = null;
    // Omitted trailing slots are empty too; interior holes retain slot identity.
    while (state.inventory.length && state.inventory.at(-1) === null) state.inventory.pop();
    state.gold += item.sell;
    champion.armor -= item.armor;
    champion.magicResist -= item.magicResist;
    champion.damage -= item.damage;
    champion.speed -= item.speed;
    champion.maxHp -= item.hp;
    this.changeItemMana(champion, -('mana' in item ? item.mana : 0));
    // Local health-removal policy; native missing-health behavior needs calibration.
    if (this.alive(champion))
      champion.hp = Math.min(champion.maxHp, Math.max(1, champion.hp - item.hp));
    return null;
  }
  static fromSnapshot(text: string, battlefield: Battlefield): World {
    const state = decodeSnapshot(text, battlefield);
    if (state.matchMode === 'lanes' && battlefield.id !== 'rift')
      throw new Error('Lane matches require Summoner’s Rift.');
    if (state.battlefield !== battlefield.id)
      throw new Error('Saved match uses a different battlefield.');
    if (
      state.units.some(
        (u) =>
          u.kind === 'monster' &&
          (Math.abs(u.monster.home.x) > battlefield.half ||
            Math.abs(u.monster.home.y) > battlefield.half)
      )
    )
      throw new Error('Saved monster home is outside the battlefield.');
    if (
      state.units.some((u) => u.lane !== null && u.lane >= battlefield.lanes.length) ||
      state.pendingSpawns.some((u) => u.lane >= battlefield.lanes.length)
    )
      throw new Error('Saved match contains an invalid lane.');
    const world = new World(false, battlefield);
    const {
      version: _version,
      ruleset: _ruleset,
      battlefield: _battlefield,
      randomState,
      otherChampions,
      ...fields
    } = state;
    Object.assign(world, fields);
    world.championRecords = new Map([state.player, ...otherChampions].map((p) => [p.id, p]));
    world.random.state = randomState;
    // Presentation events are transient; replaying them would repeat sounds and combat text.
    world.events = [];
    return world;
  }
  snapshot(): string {
    return encodeSnapshot({
      version: SNAPSHOT_VERSION,
      matchMode: this.matchMode,
      encounter: this.encounter,
      jungleCamps: this.jungleCamps,
      pendingWards: this.pendingWards,
      scuttlers: this.scuttlers,
      companions: this.companions,
      ruleset: SNAPSHOT_RULESET,
      winner: this.winner,
      firstBloodClaimed: this.firstBloodClaimed,
      battlefield: this.battlefield.id,
      pendingSpawns: this.pendingSpawns,
      tick: this.tick,
      nextId: this.nextId,
      units: this.units,
      player: this.player,
      otherChampions: this.activeChampionStates().filter((p) => p.id !== this.player.id),
      projectiles: this.projectiles,
      luxBeams: this.luxBeams,
      luxAttackVisuals: this.luxAttackVisuals,
      grompAttackVisuals: this.grompAttackVisuals,
      luxImpactVisuals: this.luxImpactVisuals,
      luxIlluminationVisuals: this.luxIlluminationVisuals,
      sunlightVisuals: this.sunlightVisuals,
      ahriOrbs: this.ahriOrbs,
      ahriFoxFires: this.ahriFoxFires,
      ahriRushes: this.ahriRushes,
      ahriCounters: this.ahriCounters,
      ahriEssences: this.ahriEssences,
      nextSunlightVisual: this.nextSunlightVisual,
      singularities: this.singularities,
      luxEAudio: this.luxEAudio,
      pendingAttackProjectiles: this.pendingAttackProjectiles,
      randomState: this.random.state,
      wave: this.wave,
      nextWaveTick: this.nextWaveTick,
      reveal: this.reveal,
      visionAreas: this.visionAreas,
      scoutVisuals: this.scoutVisuals,
      bindingStops: this.bindingStops,
      nextBindingAudioVariant: this.nextBindingAudioVariant,
      volleyHits: this.volleyHits,
      commands: this.commands,
      teamPlans: this.teamPlans,
    });
  }
}
