import { LUX_BINDING_STOP_HISTORY_TICKS } from '../content/lux-binding-presentation';
import type { BindingFlightStop } from './types';
import { impactTargetRig } from '../content/impact-target';
import { structurePose } from '../render/structure-pose';
import { structureAnimationProfile } from '../content/structure-animation';
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
import type { LuxImpactVisual, LuxAttackVisual, LuxIlluminationVisual } from './types';
import { LUX_ILLUMINATION_HISTORY_TICKS } from '../content/lux-illumination-presentation';
import { ASHE_FLURRY_INTERVAL_TICKS } from '../content/ashe-flurry-timing';
import { LUX_BINDING } from '../content/lux-binding';
import { LUX_ILLUMINATION } from '../content/lux-illumination';
import { LUX_E_SOURCE as LUX_E } from '../content/lux-e';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { DEATHCAP_AP_AMPLIFICATION, LOST_CHAPTER } from '../content/mage-items';
import { LUX_BOT_POLICY } from '../content/lux-bot-policy';
import { botDisengagePoint } from './bot-disengage';
import { LUX_W } from '../content/lux-w';
import { LUX_R } from '../content/lux-r';
import { championProfile } from '../content/champion-profiles';
import { damageAfterResistance } from './damage-math';
import { CHAMPION_BASE_KILL_GOLD, FIRST_BLOOD_BONUS } from '../content/champion-kill-gold';
import { DORANS_BLADE_OMNIVAMP, MINION_AREA_OMNIVAMP_MULTIPLIER } from '../content/omnivamp';
import { HAWKSHOT_ASSIST_SECONDS } from '../content/hawkshot-assist';
import { ASSIST_WINDOW_SECONDS } from '../content/assist-window';
import { MINION_XP_SHARES } from '../content/minion-xp-sharing';
import { createChampionState, rechargeChampion, expireChampionFocus } from './champion-state';
import { hastedCooldownTicks, itemAbilityHaste } from './ability-haste';
import { decodeSnapshot, encodeSnapshot, SNAPSHOT_RULESET, SNAPSHOT_VERSION } from './snapshot';
import { PRACTICE_FIXTURE } from '../content/practice-fixture';
import type { Battlefield } from './battlefield';
import {
  ABILITIES,
  DT,
  ITEMS,
  ITEM_RECIPES,
  RECALL_DURATION_TICKS,
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
import { direction, distance, Random, sweepCircle, type Vec2 } from './math';
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
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  luxBeams: LuxBeam[] = [];
  luxAttackVisuals: LuxAttackVisual[] = [];
  luxImpactVisuals: LuxImpactVisual[] = [];
  luxIlluminationVisuals: LuxIlluminationVisual[] = [];
  singularities: Singularity[] = [];
  pendingAttackProjectiles: Projectile[] = [];
  events: SimEvent[] = [];
  commands: Command[] = [];
  random = new Random(26018);
  player: PlayerState;
  private championRecords = new Map<number, ChampionState>();
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

  pendingSpawns: { tick: number; kind: UnitKind; team: Team; lane: number; offset: number }[] = [];

  constructor(
    populate = true,
    readonly battlefield: Battlefield = PRACTICE_FIXTURE,
    playerChampion: 'ashe' | 'lux' = 'ashe'
  ) {
    this.nextWaveTick = Math.round(battlefield.waves.initialSeconds * TICK_RATE);
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
  get hero(): Unit {
    return this.units.find((u) => u.id === this.player.id)!;
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
    const audience = (['blue', 'red'] as const).filter((team) =>
      privateFeedback
        ? team === (data.team ?? 'blue')
        : unit?.team === team || this.pointVisible(p, team)
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
  spawn(kind: UnitKind, team: Team, point: Vec2, identity: 'ashe' | 'lux' = 'ashe'): Unit {
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
    const u: Unit = {
      ...(champion ? { champion: identity } : {}),
      id: this.nextId++,
      kind,
      team,
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
      stunUntil: 0,
      rootUntil: 0,
      silenceUntil: 0,
      shields: [],
      illumination: [],
      summonerHealReductionUntil: 0,
      summonerHealSpeedUntil: 0,
      deadAt: null,
      ai: !champion && !dummy && (!structure || turret),
      aiRetreating: false,
      nextThink: 0,
      respawnTick: null,
    };
    const stats = this.battlefield.unitStats?.[kind]?.[team];
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
        createChampionState(u.id, this.battlefield.id === 'practice-fixture')
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
    if (champion && identity === 'lux') {
      const own = this.championState(u.id)!;
      own.eCharges = 0;
    }
    return u;
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
    } else if (command.type === 'learn') {
      this.commands.push({ type: 'learn', unit: command.unit, ability: command.ability });
    } else this.commands.push({ type: 'recall', unit: command.unit });
  }
  setOrder(u: Unit, order: Order): void {
    u.order = order;
    if (order.type !== 'attack' || order.target !== u.attackTarget) {
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
      u.attackCycle = null;
    }
    u.path = [];
    u.pathTarget = null;
    u.pathDestination = null;
    u.nextPathTick = this.tick;
    const state = this.championState(u.id);
    if (state) {
      state.recallEnd = null;
      if (!state.pendingCast) state.castAnimation = null;
    }
  }
  step(count = 1): void {
    for (let i = 0; i < count && !this.winner; i++) this.update();
  }
  private update(): void {
    const unseen = this.unseenBeforeHawkshot();
    this.tick++;
    this.luxIlluminationVisuals = this.luxIlluminationVisuals.filter(
      (v) => this.tick < v.startTick + LUX_ILLUMINATION_HISTORY_TICKS
    );
    this.luxImpactVisuals = this.luxImpactVisuals.filter(
      (v) => this.tick < v.startTick + LUX_IMPACT_HISTORY_TICKS
    );
    this.luxAttackVisuals = this.luxAttackVisuals.filter(
      (v) => v.stopTick === null || this.tick < v.stopTick + LUX_ATTACK_VISUAL_TAIL_TICKS
    );
    for (const unit of this.units)
      if (unit.slows.length) unit.slows = unit.slows.filter((slow) => slow.endTick > this.tick);
    for (const unit of this.units)
      if (unit.shields.length)
        unit.shields = unit.shields.filter((shield) => shield.endTick > this.tick);
    this.luxBeams = this.luxBeams.filter(
      (beam) => this.tick < beam.startTick + LUX_R.presentationSeconds * TICK_RATE
    );
    for (const unit of this.units)
      if (unit.illumination.length)
        unit.illumination = unit.illumination.filter((mark) => mark.endTick > this.tick);
    for (const state of this.activeChampionStates()) {
      if (state.skillPoints === 0 || !this.unit(state.id)?.ai) continue;
      while (state.skillPoints > 0) {
        const allocated = Object.values(state.spellRanks).reduce((sum, rank) => sum + rank, 0);
        const recommendation =
          this.unit(state.id)?.champion === 'lux' ? LUX_BOT_POLICY : ASHE_SKILL_RECOMMENDATION;
        const early = recommendation.early[allocated];
        const choices = early ? [early, ...recommendation.priority] : recommendation.priority;
        const ability = choices.find((key) => this.spellLearningError(key, state.id) === null);
        if (!ability) break;
        this.learnSpell(ability, state.id);
      }
    }
    // Serial recharge continues through death. Resolve before commands so a
    // newly restored charge can be used on its deadline tick.
    for (const state of this.activeChampionStates()) rechargeChampion(state, this.tick);
    this.visionAreas = this.visionAreas.filter((area) => area.endTick > this.tick);
    this.bindingStops = this.bindingStops.filter(
      (flight) => this.tick < flight.stopTick + LUX_BINDING_STOP_HISTORY_TICKS
    );
    this.scoutVisuals = this.scoutVisuals.filter((effect) => effect.endTick > this.tick);
    for (const unit of this.units) unit.previous = { x: unit.x, y: unit.y };
    for (const zone of this.singularities)
      if (zone.arrivalTick !== null && zone.detonatedTick === null && zone.endTick! > this.tick)
        this.slowSingularity(zone);
    const commands = this.commands.splice(0);
    for (const command of commands) {
      const u = this.unit(command.unit);
      if (!u) continue;
      if (command.type === 'learn') {
        const error = this.learnSpell(command.ability, u.id);
        if (error) this.emit('message', u, { text: error, unit: u.id, team: u.team });
        continue;
      }
      if (!this.alive(u)) continue;
      if (
        u.stunUntil > this.tick &&
        !(command.type === 'cast' && ABILITIES[command.ability].canCastWhileDisabled)
      )
        continue;
      if (command.type === 'order') {
        this.setOrder(u, command.order);
        if (command.order.type === 'move' || command.order.type === 'attackMove')
          this.emit('move', command.order.point, { team: u.team });
      } else if (command.type === 'cast') this.cast(u, command.ability, command.point);
      else {
        const state = this.championState(u.id);
        if (state && !state.pendingCast && u.silenceUntil <= this.tick) {
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
    for (const u of this.units) {
      if (!this.alive(u)) {
        if (u.respawnTick !== null && this.tick >= u.respawnTick) this.respawn(u);
        continue;
      }
      if (u.structure?.regenPerSecond)
        u.hp = Math.min(u.maxHp, u.hp + u.structure.regenPerSecond * DT);
      const thinkNow = u.ai && this.tick >= u.nextThink;
      if (thinkNow) {
        this.planDefensiveHeal(u);
        u.nextThink = this.tick + 18;
      }
      const state = this.championState(u.id);
      if (state?.pendingCast) {
        const cast = state.pendingCast;
        if (this.tick < cast.releaseTick) continue;
        state.pendingCast = null;
        if (u.champion === 'lux' && cast.ability === 'r')
          this.releaseFinalSpark(u, cast.origin!, cast.point, cast.damage);
        else if (u.champion === 'lux' && cast.ability === 'w')
          this.releasePrismatic(u, cast.point, cast.shield!, cast.startTick);
        else if (cast.ability === 'q') this.releaseLightBinding(u, cast.point, cast.damage);
        else if (u.champion === 'lux' && cast.ability === 'e') this.releaseSingularity(u, cast);
        else if (cast.ability === 'e') this.releaseHawkshot(u, cast.point);
        else this.releaseArrowSpell(u, cast.ability, cast.point, cast.damage, cast.rank);
      }
      if (u.stunUntil > this.tick) {
        const state = this.championState(u.id);
        if (state) state.castAnimation = null;
        u.attackCycle = null;
        if (u.releaseTick !== null) {
          u.releaseTick = null;
          u.nextAttackTick = this.tick;
        }
        continue;
      }
      if (thinkNow) this.think(u);
      this.advanceUnit(u);
      if (this.winner) {
        this.advanceAnimationClocks();
        this.advanceImpactVisuals();
        return;
      }
    }
    this.creditHawkshotReveals(unseen);
    this.advanceProjectiles(unseen);
    this.advanceSingularities();
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
      const home = this.battlefield.spawns[h.team];
      h.x = home.x;
      h.y = home.y;
      h.previous = { ...home };
      h.hp = h.maxHp;
      h.mana = h.maxMana;
      state.recallEnd = null;
      this.emit('heal', h, { value: h.maxHp, unit: h.id, team: h.team });
    }
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
          (fountain ? h.maxHp * 0.09 : profile.healthRegen + profile.healthRegenGrowth * growth) *
            DT
      );
      h.mana = Math.min(
        h.maxMana,
        h.mana +
          (fountain ? h.maxMana * 0.12 : profile.manaRegen + profile.manaRegenGrowth * growth) * DT
      );
    }
    // Continuous fractional accrual is our cadence policy; see docs/ECONOMY.md.
    if (this.tick > AMBIENT_GOLD.startSeconds * TICK_RATE)
      for (const state of this.activeChampionStates())
        state.gold = statPrecision(
          state.gold + (AMBIENT_GOLD.amount / AMBIENT_GOLD.intervalSeconds) * DT
        );
    for (const state of this.activeChampionStates()) expireChampionFocus(state, this.tick);
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
  visible(u: Unit, team: Team = 'blue'): boolean {
    return u.team === team || this.pointVisible(u, team);
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
  visionSources(
    team: Team = 'blue',
    includeAttackReveals = true,
    includeHawkshots = true
  ): VisionSource[] {
    const sources: VisionSource[] = this.units
      .filter((u) => u.team === team && this.alive(u))
      .map((u) => ({ x: u.x, y: u.y, radius: sightRadius(u) }));
    sources.push(
      ...this.visionAreas.filter(
        (a) =>
          a.team === team &&
          a.endTick > this.tick &&
          (includeAttackReveals || a.kind === 'scout') &&
          (includeHawkshots || a.kind !== 'scout')
      )
    );
    sources.push(
      ...this.projectiles
        .filter((projectile) => projectile.team === team && projectile.type === 'ultimate')
        .map((projectile) => ({ x: projectile.x, y: projectile.y, radius: ASHE_R.sightRadius }))
    );
    sources.push(
      ...this.projectiles
        .filter(
          (projectile) =>
            includeHawkshots && projectile.team === team && projectile.type === 'hawkshot'
        )
        // Radius remains provisional until reference geometry is verified.
        .map((projectile) => ({
          x: projectile.x,
          y: projectile.y,
          radius: 650,
          unobstructed: true,
        }))
    );
    sources.push(
      ...this.singularities
        .filter(
          (z) =>
            z.team === team &&
            z.arrivalTick !== null &&
            z.detonatedTick === null &&
            z.endTick! > this.tick
        )
        .map((z) => ({ x: z.x, y: z.y, radius: LUX_E.visionRadius, unobstructed: true }))
    );
    if (team === 'blue' && this.reveal && this.reveal.endTick > this.tick)
      sources.push({ ...this.reveal.point, radius: 650, unobstructed: true });
    return sources;
  }
  pointVisible(point: Vec2, team: Team = 'blue'): boolean {
    return seenFrom(point, this.visionSources(team), this.battlefield.lineOfSight);
  }
  projectileVisible(projectile: Projectile, team: Team = 'blue'): boolean {
    return projectile.team === team || this.pointVisible(projectile, team);
  }
  eventVisible(event: SimEvent, team: Team = 'blue'): boolean {
    return event.audience.includes(team);
  }
  vulnerable(unit: Unit): boolean {
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
  private validTarget(u: Unit, target: Unit | undefined): target is Unit {
    return (
      !!target &&
      target.team !== u.team &&
      this.alive(target) &&
      this.vulnerable(target) &&
      this.visible(target, u.team)
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
    if (
      u.kind !== 'champion' ||
      u.hp >= u.maxHp * 0.22 ||
      distance(u, this.battlefield.spawns[u.team]) <= 400 ||
      this.abilityCooldownTicks('f', u.id) > 0
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
      this.enqueue({ type: 'cast', unit: u.id, ability: 'f', point: { x: u.x, y: u.y } });
  }
  private estimatedAttackDelay(u: Unit, target: Unit): number {
    // Stationary-target estimate shared by farming and incoming-missile decisions.
    const windup = Math.round(u.windupTicks / this.attackSpeedMultiplier(u, target));
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
    // Estimate only the first Q impact; later arrows may arrive too late.
    const base = u.damage * this.basicAttackDamageMultiplier(u);
    const raw =
      state.qUntil > this.tick ? asheFocusFlurry(state.spellRanks.q, base)[0].damage : base;
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
    if (u.champion === 'lux') {
      let id: string | undefined = LUX_BOT_POLICY.purchases.find(
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
    let id = ['blade', 'boots'].find((id) => !state.inventory.includes(id));
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
          this.vulnerable(target)
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
          enemy.hp + this.shieldAmount(enemy) <= damageAfterResistance(raw, enemy.magicResist)
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
        if (target.hp + this.shieldAmount(target) > damageAfterResistance(raw, target.magicResist))
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
    if (u.silenceUntil > this.tick) return false;
    const home = this.battlefield.spawns[u.team];
    if (
      u.rootUntil > this.tick ||
      u.hp >= u.maxHp * 0.12 ||
      distance(u, home) <= 400 ||
      this.abilityCooldownTicks('d', u.id) > 0
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
    this.enqueue({ type: 'cast', unit: u.id, ability: 'd', point: aim });
    return true;
  }
  private think(u: Unit): void {
    if (u.kind !== 'champion') return;
    if (u.hp < u.maxHp * 0.22) u.aiRetreating = true;
    if (u.aiRetreating && u.hp >= u.maxHp * 0.85) u.aiRetreating = false;
    if (u.aiRetreating) {
      const home = this.battlefield.spawns[u.team];
      const state = this.championState(u.id)!;
      if (this.planLuxCombat(u, true)) return;
      if (this.planEmergencyFlash(u)) return;
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
      if (this.planLuxCombat(u, true) || this.planCrystalArrow(u, 'peel')) return;
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
    if (this.planCrystalArrow(u, 'finish')) return;
    if (this.planLuxCombat(u, false)) return;
    const safeTarget = (target: Unit) =>
      this.safeAttackPosition(u, target) && !this.incomingAttacksClaimMinion(u, target);
    const nearest = this.nearest(u, 1150, false, safeTarget);
    const closeThreat = this.nearest(u, 380, true, safeTarget);
    // An immediate champion threat keeps priority over farming.
    const target =
      closeThreat && distance(u, closeThreat) < 380
        ? closeThreat
        : (this.lastHitTarget(u) ?? nearest);
    if (target) {
      const d = distance(u, target);
      const state = this.championState(u.id)!;
      // Spend Focus against a visible champion during recovery, preserving a
      // committed windup above. The queued cast is validated next tick like input.
      if (
        target.kind === 'champion' &&
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
      if (d < 380 && target.kind === 'champion' && this.tick < u.nextAttackTick) {
        let away = direction(target, u);
        if (away.x === 0 && away.y === 0) away = direction(u, this.battlefield.spawns[u.team]);
        this.setOrder(u, { type: 'move', point: { x: u.x + away.x * 180, y: u.y + away.y * 180 } });
      } else if (u.order.type !== 'attack' || u.order.target !== target.id)
        this.setOrder(u, { type: 'attack', target: target.id });
    } else if (this.nearest(u, 1150)) {
      // Visible opponents remain, but none offers a safe attack position.
      // Hold rather than resuming the lane route into their tower protection.
      if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
    } else if (this.battlefield.id === 'rift') {
      this.advanceChampionLane(u);
      this.planLaneScout(u);
    } else if (u.order.type !== 'move')
      this.setOrder(u, {
        type: 'move',
        point: { x: 650, y: -490 },
      });
  }
  private advanceUnit(u: Unit): void {
    const state = this.championState(u.id);
    let target = u.attackTarget === null ? undefined : this.unit(u.attackTarget);
    if (u.releaseTick !== null) {
      if (!this.validTarget(u, target)) {
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
          this.emit('attack', u, { unit: u.id, team: u.team });
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
          if (!u.missileSpeed)
            this.hitBasicAttack(
              u,
              target,
              payloads.reduce((sum, p) => sum + p.damage, 0)
            );
          else
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
              if (u.champion === 'lux')
                this.luxAttackVisuals.push({
                  origin: { x: u.x, y: u.y },
                  id: projectile.id,
                  sourceId: u.id,
                  team: u.team,
                  launchTick: this.tick,
                  stopTick: null,
                  frames: [],
                });
            }
        }
        return;
      }
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
      const inRange = distance(u, target) <= u.range + target.radius;
      if (inRange) {
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
        if (this.tick >= u.nextAttackTick) {
          const speed = this.attackSpeedMultiplier(u, target);
          u.attackTarget = target.id;
          u.releaseTick = this.tick + Math.round(u.windupTicks / speed);
          u.nextAttackTick = this.tick + Math.round(u.attackPeriod / speed);
          const state = this.championState(u.id);
          if (state) state.castAnimation = null;
          u.attackCycle = {
            startTick: this.tick,
            endTick: u.nextAttackTick,
            empowered: state !== undefined && this.tick < state.qUntil,
            ...(u.kind === 'champion' &&
            !isStructureKind(target.kind) &&
            this.criticalChance(u) > 0 &&
            this.random.next() < this.criticalChance(u)
              ? { critical: true as const }
              : {}),
          };
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
  private move(u: Unit, point: Vec2): void {
    if (!u.speed || u.rootUntil > this.tick) return;
    if (
      (!u.pathTarget || distance(u.pathTarget, point) > 90 || !u.path.length) &&
      this.tick >= u.nextPathTick
    ) {
      u.path = this.battlefield.findPath(u, point, u.radius, u.team);
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
    const haste = u.summonerHealSpeedUntil > this.tick ? 1 + SUMMONER_HEAL.speedBonus : 1;
    return u.speed * this.slowFactor(u) * haste;
  }
  slowFactor(u: Unit): number {
    // Retain the old diagnostic fields, but all new combat applications also
    // retain independent source/effect state so later hits cannot erase them.
    let slow = u.slowUntil > this.tick ? u.slowMultiplier : 1;
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
      !this.vulnerable(target) ||
      isStructureKind(target.kind) ||
      (kind === 'lucent' ? source.champion !== 'lux' : source.champion !== 'ashe') ||
      !['frost', 'critical-frost', 'crystal-arrow', 'lucent'].includes(kind) ||
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
      endTick: this.tick + durationTicks,
      startMultiplier,
      endMultiplier,
    };
    const index = target.slows.findIndex((s) => s.sourceId === source.id && s.kind === kind);
    if (index === -1) target.slows.push(effect);
    else target.slows[index] = effect;
    return true;
  }
  applyRoot(target: Unit, durationTicks: number): boolean {
    if (
      this.winner ||
      !this.alive(target) ||
      isStructureKind(target.kind) ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks)
    )
      return false;
    target.rootUntil = Math.max(target.rootUntil, this.tick + durationTicks);
    return true;
  }
  /** Silence blocks new spell actions without stopping movement/basic attacks.
   * Current pending casts are non-channel windups and continue to release. */
  applySilence(target: Unit, durationTicks: number): boolean {
    if (
      this.winner ||
      !this.units.includes(target) ||
      !this.alive(target) ||
      isStructureKind(target.kind) ||
      !Number.isSafeInteger(durationTicks) ||
      durationTicks <= 0 ||
      !Number.isSafeInteger(this.tick + durationTicks)
    )
      return false;
    target.silenceUntil = Math.max(target.silenceUntil, this.tick + durationTicks);
    const state = this.championState(target.id);
    if (state) state.recallEnd = null;
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
    this.singularities.push({
      id: this.nextId++,
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
    });
  }
  private singularityTargets(zone: Singularity): Unit[] {
    return this.units.filter(
      (u) =>
        u.team !== zone.team &&
        this.alive(u) &&
        this.vulnerable(u) &&
        !isStructureKind(u.kind) &&
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
      const mobileAlive = !isStructureKind(unit.kind) && this.alive(unit);
      const moving =
        mobileAlive && Math.hypot(unit.x - unit.previous.x, unit.y - unit.previous.y) > 0.01;
      if (moving) {
        const nominal = this.battlefield.unitStats?.[unit.kind]?.[unit.team]?.speed ?? 325;
        const clock = unit.runClock ?? { startTick: this.tick, previous: 0, current: 0 };
        clock.previous = clock.current;
        clock.current += DT * (nominal > 0 ? this.movementSpeed(unit) / nominal : 1);
        unit.runClock = clock;
      } else unit.runClock = null;
      const state = this.championState(unit.id),
        cast = state?.castAnimation;
      const casting =
        !!cast &&
        !!unit.champion &&
        (this.tick - cast.startTick) / TICK_RATE <
          castAnimationDuration(unit.champion, cast.ability);
      const attacking = unit.attackCycle !== null && this.tick < unit.attackCycle.endTick;
      if (mobileAlive && !moving && !casting && !attacking && state?.recallEnd == null) {
        const clock = unit.idleClock ?? { startTick: this.tick, previous: 0, current: 0 };
        clock.previous = clock.current;
        clock.current += DT;
        unit.idleClock = clock;
      } else unit.idleClock = null;
      const durations = mobileClipDurations(unit);
      if (durations)
        unit.animationTimeline = advanceAnimationTimeline(
          unit.animationTimeline,
          mobilePose(unit, state, this.tick, 1, durations),
          this.tick,
          durations
        );
    }
  }
  private captureImpactFrame(target: Unit) {
    return {
      tick: this.tick,
      x: target.x,
      y: target.y,
      facing: target.facing,
      animationTimeline: structuredClone(target.animationTimeline),
      structurePose: isStructureKind(target.kind)
        ? structurePose(
            {
              destroyed: !this.alive(target),
              deathTick: target.deadAt,
              idleStartTick: target.structureIdle!.startTick,
            },
            structureAnimationProfile(target),
            this.tick,
            1
          )
        : null,
    };
  }
  private advanceImpactVisuals(): void {
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
      this.luxAttackVisuals.filter((v) => v.stopTick === null).map((v) => v.id)
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
        if (!target || !this.alive(target)) continue;
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
      if (p.type === 'binding') {
        const hits = this.units
          .flatMap((u) => {
            if (
              !this.alive(u) ||
              u.team === p.team ||
              isStructureKind(u.kind) ||
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
        if (!this.alive(u) || u.team === p.team) continue;
        if (p.target !== null && u.id !== p.target) continue;
        if (p.type === 'ultimate' && u.kind !== 'champion' && u.kind !== 'dummy') continue;
        if (p.type !== 'attack' && isStructureKind(u.kind)) continue;
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
            !isStructureKind(contact.kind) &&
            (p.flurryShot ?? 0) === 0
          ) {
            contact.slowMultiplier = p.type === 'ultimate' ? 0.7 : 1 - slow;
            contact.slowUntil = this.tick + ASHE_PASSIVE.durationSeconds * TICK_RATE;
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
                endTick: this.tick + TICK_RATE,
                startMultiplier: 1 - peak,
                endMultiplier: 1 - slow,
              };
              this.applySlow(source, contact, 'critical-frost', TICK_RATE, 1 - peak, 1 - slow);
            }
          }
          if (p.type === 'ultimate') {
            const distanceTravelled = ASHE_R.range - p.remaining + travel * first;
            contact.stunUntil = this.tick + crystalArrowStunTicks(distanceTravelled);
            for (const victim of this.units) {
              if (
                victim.id === contact.id ||
                victim.team === p.team ||
                !this.alive(victim) ||
                isStructureKind(victim.kind) ||
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
              if (this.alive(victim)) {
                victim.slowMultiplier = 1 - slow;
                victim.slowUntil = this.tick + ASHE_PASSIVE.durationSeconds * TICK_RATE;
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
    const survivingIds = new Set(this.projectiles.map((p) => p.id));
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
      visual.frames.push({ ...frame, trailDistance });
      if (visual.frames.length > LUX_ATTACK_PATH_FRAMES) visual.frames.shift();
    }
  }
  attackSpeedMultiplier(source: Unit, target: Unit | undefined): number {
    const state = this.championState(source.id);
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
        !this.vulnerable(target) ||
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
      !this.vulnerable(target) ||
      isStructureKind(target.kind)
    )
      return;
    const endTick = this.tick + LUX_ILLUMINATION.durationSeconds * TICK_RATE;
    const mark = target.illumination.find((entry) => entry.sourceId === source.id);
    if (mark) mark.endTick = endTick;
    else target.illumination.push({ sourceId: source.id, endTick });
  }
  private hitBasicAttack(source: Unit, target: Unit, raw: number): void {
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
      isLaneMinionKind(source.kind) && isLaneMinionKind(target.kind)
        ? (this.battlefield.minionCurrentHealthDamage?.[source.kind]?.[source.team] ?? 0)
        : 0;
    // Sample at impact, before this hit changes HP. Ranged attacks retain release AD.
    const illuminated =
      source.champion === 'lux' &&
      this.vulnerable(target) &&
      target.illumination.some((mark) => mark.sourceId === source.id && mark.endTick > this.tick);
    if (illuminated) this.captureIlluminationVisual(source, target);
    if (illuminated)
      target.illumination = target.illumination.filter((mark) => mark.sourceId !== source.id);
    this.damage(source, target, raw * multiplier + target.hp * healthRatio, 'physical');
    if (illuminated && this.alive(target)) {
      this.damage(source, target, this.illuminationDamage(source), 'magic');
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
    category: 'direct' | 'area' = 'direct'
  ): void {
    if (this.winner || !this.alive(target) || !this.vulnerable(target)) return;
    const resistance =
      kind === 'physical' ? target.armor : kind === 'magic' ? target.magicResist : 0;
    const amount = damageAfterResistance(raw, resistance);
    let remainder = Math.max(0, amount);
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
    const attacker = this.championState(source.id);
    if (
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
    this.emit('damage', target, { unit: target.id, value: Math.round(amount), team: source.team });
    const targetState = this.championState(target.id);
    if (targetState) {
      if (healthLost > 0) targetState.recallEnd = null;
      if (amount > 0 && source.team !== target.team && this.championState(source.id)) {
        const index = targetState.damageContributors.findIndex(
          (entry) => entry.sourceId === source.id
        );
        // Order by actual damage processing, including multiple hits in one tick.
        // Refreshing in place loses which attacker most recently contributed.
        if (index !== -1) targetState.damageContributors.splice(index, 1);
        targetState.damageContributors.push({ sourceId: source.id, lastDamageTick: this.tick });
      }
    }
    if (target.kind === 'champion')
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
      target.shields = [];
      target.slows = [];
      target.illumination = [];
      target.releaseTick = null;
      target.attackCycle = null;
      target.order = { type: 'idle' };
      this.emit('death', target, { unit: target.id });
      // Structure destruction is public map knowledge. It grants no live sight
      // and does not broaden the audience of the preceding damage event.
      if (target.structureKnowledge)
        target.structureKnowledge = { blue: this.tick, red: this.tick };
      if (target.kind === 'champion') {
        const level = targetState?.level ?? 1;
        target.respawnTick = this.tick + championDeathTicks(level, this.tick);
      }
      if (target.kind === 'dummy') target.respawnTick = this.tick + 3 * TICK_RATE;
      if (target.kind === 'inhibitor') target.respawnTick = this.tick + 300 * TICK_RATE;
      if (target.structure?.role === 'nexus-turret')
        target.respawnTick = this.tick + 180 * TICK_RATE;
      if (target.kind === 'nexus') {
        this.winner = target.team === 'blue' ? 'red' : 'blue';
        for (const state of this.activeChampionStates()) {
          state.pendingCast = null;
          state.castAnimation = null;
        }
        this.projectiles.length = 0;
        this.pendingAttackProjectiles.length = 0;
        this.commands.length = 0;
        this.pendingSpawns.length = 0;
        for (const unit of this.units) this.setOrder(unit, { type: 'idle' });
      }
      if (targetState) {
        targetState.enlighten = null;
        targetState.deaths++;
        targetState.pendingCast = null;
        targetState.castAnimation = null;
        targetState.recallEnd = null;
        targetState.qStacks = 0;
        targetState.qStackExpiry = 0;
        targetState.qUntil = 0;
      }
      const lastDamage = targetState?.damageContributors
        .slice()
        .reverse()
        .find((entry) => this.tick - entry.lastDamageTick <= EXECUTION_CREDIT_SECONDS * TICK_RATE);
      const rewardSource =
        this.championState(source.id) && source.team !== target.team
          ? source
          : lastDamage
            ? this.unit(lastDamage.sourceId)
            : undefined;
      const sourceState = rewardSource ? this.championState(rewardSource.id) : undefined;
      const takedownContributors = targetState
        ? this.takedownContributors(targetState, rewardSource?.id)
        : new Set<number>();
      if (sourceState && rewardSource && rewardSource.team !== target.team) {
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
          for (const id of takedownContributors) {
            if (id === rewardSource.id) continue;
            const contributor = this.unit(id);
            const record = this.championState(id);
            if (record && contributor?.team === rewardSource.team) record.assists++;
          }
        } else if (target.kind !== 'dummy' && !isStructureKind(target.kind)) sourceState.cs++;
      }
      if (isLaneMinionKind(target.kind)) {
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
    }
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
      h.windupTicks = Math.round((profile.windupTicks * profile.attackSpeed) / attackSpeed);
      this.emit('level', h, { text: 'Level up!', unit: h.id, team: h.team });
    }
    if (state.level === MAX_LEVEL) state.xp = 0;
  }
  private respawn(u: Unit): void {
    const state = this.championState(u.id);
    if (state) {
      state.damageContributors = [];
      state.supportContributors = [];
      state.revealContributors = [];
    }
    const point =
      isStructureKind(u.kind) || u.kind === 'dummy'
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
    u.stunUntil = 0;
    u.rootUntil = 0;
    u.silenceUntil = 0;
    u.shields = [];
    u.illumination = [];
    u.aiRetreating = false;
    u.slowUntil = 0;
    u.slows = [];
    u.slowMultiplier = 0.7;
    u.criticalSlow = null;
    this.setOrder(u, { type: 'idle' });
  }
  abilityCooldownTicks(ability: Ability, championId = this.player.id): number {
    const state = this.championState(championId);
    if (!state) return Infinity;
    const chargeDeadline = ability === 'e' && state.eCharges === 0 ? (state.eRechargeTick ?? 0) : 0;
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
  learnSpell(ability: 'q' | 'w' | 'e' | 'r', championId = this.player.id): string | null {
    const error = this.spellLearningError(ability, championId);
    if (error) return error;
    const state = this.championState(championId)!;
    state.skillPoints--;
    state.spellRanks[ability]++;
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
    return owner ? itemAbilityHaste(owner) : 0;
  }
  abilityResources(ability: Ability, championId = this.player.id) {
    const resources = this.baseAbilityResources(ability, championId);
    const owner = this.championState(championId);
    if (!owner || ability === 'd' || ability === 'f') return resources;
    return {
      ...resources,
      cooldownSeconds: (resources.cooldownSeconds * 100) / (100 + itemAbilityHaste(owner)),
    };
  }
  private baseAbilityResources(ability: Ability, championId: number) {
    if (ability === 'd' || ability === 'f')
      return { mana: ABILITIES[ability].cost, cooldownSeconds: ABILITIES[ability].cooldown };
    const rank = this.abilityRank(ability, championId);
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
  private cast(u: Unit, ability: Ability, point: Vec2): void {
    const state = this.championState(u.id);
    if (!state) return;
    // Check before Lux's E-recast shortcut as well as ordinary casts.
    if (u.silenceUntil > this.tick && !ABILITIES[ability].canCastWhileSilenced) {
      this.emit('message', u, { text: 'Cannot cast while silenced', unit: u.id, team: u.team });
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
      ability === 'd' && u.champion === 'lux' && state.pendingCast?.ability === 'r';
    if (state.pendingCast && ability !== 'f' && !flashDuringFinalSpark) return;
    const spec = ABILITIES[ability];
    const fail = (text: string) => this.emit('message', u, { text, unit: u.id, team: u.team });
    if (u.rootUntil > this.tick && spec.cantCastWhileRooted) {
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
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
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
      this.emit('cast', u, { unit: u.id, champion: u.champion, text: ability, team: u.team });
      return;
    }
    if (['w', 'r', 'd'].includes(ability) && dir.x === 0 && dir.y === 0) return;
    u.mana -= resources.mana;
    state.cooldowns[ability] = this.tick + Math.ceil(resources.cooldownSeconds * TICK_RATE);
    if (!spec.preservesRecall) state.recallEnd = null;
    if (ability !== 'f' && !flashDuringFinalSpark) state.castAnimation = null;
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
        u.attackCycle = null;
        u.nextAttackTick = this.tick;
      }
    }
    if (ability === 'w' || ability === 'e' || ability === 'r') {
      const timing = ASHE_CASTS[ability];
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null;
      u.attackTarget = null;
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
          itemAbilityHaste(state)
        );
        state.eRechargeTick = this.tick + state.eRechargeDurationTicks;
      }
    }
    if (ability === 'd') {
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
    if (ability === 'f') {
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
    if (!state || !champion) return 'Unknown champion';
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return 'Unknown item';
    if (distance(champion, this.battlefield.spawns[champion.team]) > 400 && champion.hp > 0)
      return 'Return to your fountain to purchase items';
    const plan = this.purchasePlan(itemId, championId)!;
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
    if (!state || !champion) return 'Unknown champion';
    if (!Number.isInteger(slot) || slot < 0 || slot >= state.inventory.length)
      return 'Choose an owned item';
    if (distance(champion, this.battlefield.spawns[champion.team]) > 400 && this.alive(champion))
      return 'Return to your fountain to sell items';
    const item = ITEMS.find((entry) => entry.id === state.inventory[slot]);
    if (!item) return 'Unknown item';
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
    const state = decodeSnapshot(text);
    if (state.matchMode === 'lanes' && battlefield.id !== 'rift')
      throw new Error('Lane matches require Summoner’s Rift.');
    if (state.battlefield !== battlefield.id)
      throw new Error('Saved match uses a different battlefield.');
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
      luxImpactVisuals: this.luxImpactVisuals,
      luxIlluminationVisuals: this.luxIlluminationVisuals,
      singularities: this.singularities,
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
    });
  }
}
