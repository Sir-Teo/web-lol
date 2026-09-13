import { CHAMPION_BASE_KILL_GOLD, FIRST_BLOOD_BONUS } from '../content/champion-kill-gold';
import { HAWKSHOT_ASSIST_SECONDS } from '../content/hawkshot-assist';
import { ASSIST_WINDOW_SECONDS } from '../content/assist-window';
import { MINION_XP_SHARES } from '../content/minion-xp-sharing';
import { createChampionState, rechargeChampion, expireChampionFocus } from './champion-state';
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
import { crystalArrowStunTicks } from './crystal-arrow';
import { ASHE_PASSIVE } from '../content/ashe-passive';
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
} from './types';

export class World {
  tick = 0;
  winner: Team | null = null;
  firstBloodClaimed = false;
  nextId = 1;
  units: Unit[] = [];
  projectiles: Projectile[] = [];
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

  pendingSpawns: { tick: number; kind: UnitKind; team: Team; lane: number; offset: number }[] = [];

  constructor(
    populate = true,
    readonly battlefield: Battlefield = PRACTICE_FIXTURE
  ) {
    this.nextWaveTick = Math.round(battlefield.waves.initialSeconds * TICK_RATE);
    const champion = this.spawn('champion', 'blue', battlefield.spawns.blue);
    champion.name = 'Ashe';
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
  spawn(kind: UnitKind, team: Team, point: Vec2): Unit {
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
      id: this.nextId++,
      kind,
      team,
      name: champion ? 'Ashe' : turret ? 'Outer turret' : dummy ? 'Target dummy' : `${kind} minion`,
      x: point.x,
      y: point.y,
      previous: { x: point.x, y: point.y },
      facing: team === 'blue' ? 2.2 : -0.95,
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
      criticalSlow: null,
      stunUntil: 0,
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
      Object.assign(u, {
        hp: ASHE.hp,
        maxHp: ASHE.hp,
        mana: ASHE.mana,
        maxMana: ASHE.mana,
        damage: ASHE.damage,
        armor: ASHE.armor,
        magicResist: ASHE.magicResist,
        attackPeriod: Math.round(TICK_RATE / ASHE.attackSpeed),
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
    if (structure) u.structureKnowledge = { blue: false, red: false };
    if (champion) this.championRecords.set(u.id, createChampionState(u.id));
    this.units.push(u);
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
    // Serial recharge continues through death. Resolve before commands so a
    // newly restored charge can be used on its deadline tick.
    for (const state of this.activeChampionStates()) rechargeChampion(state, this.tick);
    this.visionAreas = this.visionAreas.filter((area) => area.endTick > this.tick);
    this.scoutVisuals = this.scoutVisuals.filter((effect) => effect.endTick > this.tick);
    for (const unit of this.units) unit.previous = { x: unit.x, y: unit.y };
    const commands = this.commands.splice(0);
    for (const command of commands) {
      const u = this.unit(command.unit);
      if (!u || !this.alive(u)) continue;
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
        if (state && !state.pendingCast) {
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
        if (cast.ability === 'e') this.releaseHawkshot(u, cast.point);
        else this.releaseArrowSpell(u, cast.ability, cast.point, cast.damage);
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
      if (this.winner) return;
    }
    this.creditHawkshotReveals(unseen);
    this.advanceProjectiles(unseen);
    if (this.winner) return;
    for (const unit of this.units) {
      if (!unit.structureKnowledge) continue;
      for (const team of ['blue', 'red'] as const)
        if (unit.structureKnowledge[team] !== !this.alive(unit) && this.visible(unit, team))
          unit.structureKnowledge[team] = !this.alive(unit);
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
      const fountain = distance(h, this.battlefield.spawns[h.team]) < 220;
      const growth = growthAtLevel(this.championState(h.id)?.level ?? 1);
      h.hp = Math.min(
        h.maxHp,
        h.hp + (fountain ? h.maxHp * 0.09 : ASHE.healthRegen + ASHE.healthRegenGrowth * growth) * DT
      );
      h.mana = Math.min(
        h.maxMana,
        h.mana + (fountain ? h.maxMana * 0.12 : ASHE.manaRegen + ASHE.manaRegenGrowth * growth) * DT
      );
    }
    // Continuous fractional accrual is our cadence policy; see docs/ECONOMY.md.
    if (this.tick > AMBIENT_GOLD.startSeconds * TICK_RATE)
      for (const state of this.activeChampionStates())
        state.gold = statPrecision(
          state.gold + (AMBIENT_GOLD.amount / AMBIENT_GOLD.intervalSeconds) * DT
        );
    for (const state of this.activeChampionStates()) expireChampionFocus(state, this.tick);
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
    return this.visible(u, team) ? !this.alive(u) : u.structureKnowledge[team];
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
  private nearest(u: Unit, range: number): Unit | undefined {
    let best: Unit | undefined,
      bestDistance = Infinity;
    for (const target of this.units)
      if (target.team !== u.team && this.alive(target) && target.kind !== 'dummy') {
        const d = distance(u, target) - target.radius;
        const score = d + (target.kind === 'champion' && u.kind !== 'champion' ? 300 : 0);
        if (d < range && score < bestDistance && this.validTarget(u, target)) {
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
  private think(u: Unit): void {
    if (u.kind !== 'champion') return;
    if (u.hp < u.maxHp * 0.22) u.aiRetreating = true;
    if (u.aiRetreating && u.hp >= u.maxHp * 0.85) u.aiRetreating = false;
    if (u.aiRetreating) {
      const home = this.battlefield.spawns[u.team];
      if (distance(u, home) < 100) {
        if (u.order.type !== 'idle') this.setOrder(u, { type: 'idle' });
      } else if (u.order.type !== 'move' || distance(u.order.point, home) > 1)
        this.setOrder(u, { type: 'move', point: home });
      return;
    }
    if (distance(u, this.battlefield.spawns[u.team]) <= 400) {
      const state = this.championState(u.id)!;
      // Local plan for the limited practice shop. Save toward the next item;
      // never buy repeated components merely to empty the gold balance.
      const next = ['blade', 'boots', 'pickaxe', 'sword'].find(
        (id) => !state.inventory.includes(id)
      );
      if (next) this.buy(next, u.id);
    }
    // Keep a valid committed windup; retargeting through setOrder would cancel it.
    if (u.releaseTick !== null && this.validTarget(u, this.unit(u.attackTarget ?? -1))) return;
    const target = this.nearest(u, 1150);
    if (target) {
      const d = distance(u, target);
      const state = this.championState(u.id)!;
      // Spend Focus against a visible champion during recovery, preserving a
      // committed windup above. The queued cast is validated next tick like input.
      if (
        target.kind === 'champion' &&
        d <= u.range + target.radius &&
        this.tick < u.nextAttackTick &&
        state.qStacks >= ASHE_Q.maxStacks &&
        state.qUntil <= this.tick &&
        u.mana >= ABILITIES.q.cost &&
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
        target.kind === 'champion' &&
        d > u.range + target.radius &&
        d <= ABILITIES.w.range &&
        u.mana >= ABILITIES.w.cost &&
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
    } else if (u.order.type !== 'move')
      this.setOrder(u, {
        type: 'move',
        point:
          this.battlefield.id === 'practice-fixture'
            ? { x: 650, y: -490 }
            : this.battlefield.lanes.find((lane) => lane.name === 'mid')!.points[9],
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
          if (state && this.tick >= state.qUntil) {
            state.qStacks = Math.min(ASHE_Q.maxStacks, state.qStacks + 1);
            state.qStackExpiry = this.tick + ASHE_Q.stackSeconds * TICK_RATE;
          }
          // Aggregate Q damage until the five-arrow flurry is represented.
          // Capture it at release so expiration in flight cannot change the hit.
          const damage =
            u.damage *
            (state !== undefined && this.tick < state.qUntil
              ? ASHE_Q.damageMultiplierByRank[0]
              : 1);
          if (!u.missileSpeed) this.hitBasicAttack(u, target, damage);
          else
            this.projectiles.push({
              id: this.nextId++,
              x: u.x,
              y: u.y,
              previous: { x: u.x, y: u.y },
              source: u.id,
              team: u.team,
              type: 'attack',
              target: target.id,
              direction: direction(u, target),
              damage,
              speed: u.missileSpeed,
              radius: 8,
              remaining: 4000,
              volleyId: null,
            });
        }
        return;
      }
    }
    if (u.order.type === 'attack') {
      const ordered = this.unit(u.order.target);
      target = this.validTarget(u, ordered) ? ordered : undefined;
      if (!target) this.setOrder(u, { type: 'idle' });
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
    if (!u.speed) return;
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
    return u.speed * slow * haste;
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
  private advanceProjectiles(unseen: Map<Team, Set<number>>): void {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      p.previous = { x: p.x, y: p.y };
      const source = this.unit(p.source);
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
        if (source && (p.volleyId === null || !this.volleyHits[p.volleyId]?.includes(contact.id))) {
          const level = this.championState(source.id)?.level ?? 1;
          const slow =
            ASHE_PASSIVE.slowAtLevel1 +
            ((ASHE_PASSIVE.slowAtLevel18 - ASHE_PASSIVE.slowAtLevel1) * (level - 1)) / 17;
          if (p.volleyId !== null) (this.volleyHits[p.volleyId] ??= []).push(contact.id);
          if (p.type === 'attack') this.hitBasicAttack(source, contact, p.damage);
          else this.damage(source, contact, p.damage, p.type === 'ultimate' ? 'magic' : 'physical');
          if (source.kind === 'champion' && !isStructureKind(contact.kind)) {
            contact.slowMultiplier = p.type === 'ultimate' ? 0.7 : 1 - slow;
            contact.slowUntil = this.tick + ASHE_PASSIVE.durationSeconds * TICK_RATE;
            if (p.type === 'volley' && contact.kind === 'champion') {
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
              this.damage(source, victim, p.damage * ASHE_R.splashDamageMultiplier, 'magic');
              if (this.alive(victim)) {
                victim.slowMultiplier = 1 - slow;
                victim.slowUntil = this.tick + ASHE_PASSIVE.durationSeconds * TICK_RATE;
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
  }
  attackSpeedMultiplier(source: Unit, target: Unit | undefined): number {
    const state = this.championState(source.id);
    if (state && state.qUntil > this.tick) {
      // Q is rank one until skill-point allocation is implemented. Its bonus
      // adds ratio-scaled attacks/second, not a multiplier on existing bonuses.
      const bonus = ASHE_Q.attackSpeedRatio * ASHE_Q.bonusAttackSpeedByRank[0];
      return 1 + (bonus * source.attackPeriod) / TICK_RATE;
    }
    if (source.kind === 'siege' && target?.kind === 'turret' && target.structure?.lane === 'mid')
      return 1 + (this.battlefield.siegeMidTurretAttackSpeedBonus ?? 0);
    return 1;
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
    this.damage(source, target, raw * multiplier + target.hp * healthRatio, 'physical');
  }
  damage(source: Unit, target: Unit, raw: number, kind: 'physical' | 'magic' | 'true'): void {
    if (this.winner || !this.alive(target) || !this.vulnerable(target)) return;
    const resistance =
      kind === 'physical' ? target.armor : kind === 'magic' ? target.magicResist : 0;
    const multiplier = resistance >= 0 ? 100 / (100 + resistance) : 2 - 100 / (100 - resistance);
    const amount = raw * multiplier;
    target.hp = Math.max(0, target.hp - amount);
    this.emit('damage', target, { unit: target.id, value: Math.round(amount), team: source.team });
    const targetState = this.championState(target.id);
    if (targetState) {
      targetState.recallEnd = null;
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
      target.deadAt = this.tick;
      target.releaseTick = null;
      target.attackCycle = null;
      target.order = { type: 'idle' };
      this.emit('death', target, { unit: target.id });
      // Structure destruction is public map knowledge. It grants no live sight
      // and does not broaden the audience of the preceding damage event.
      if (target.structureKnowledge) target.structureKnowledge = { blue: true, red: true };
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
        this.commands.length = 0;
        this.pendingSpawns.length = 0;
        for (const unit of this.units) this.setOrder(unit, { type: 'idle' });
      }
      if (targetState) {
        targetState.deaths++;
        targetState.pendingCast = null;
        targetState.castAnimation = null;
        targetState.recallEnd = null;
        targetState.qStacks = 0;
        targetState.qStackExpiry = 0;
        targetState.qUntil = 0;
      }
      const sourceState = this.championState(source.id);
      if (sourceState && source.team !== target.team) {
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
        if (gold) this.emit('gold', source, { value: gold, unit: source.id, team: source.team });
        if (target.kind === 'champion') {
          sourceState.kills++;
          const assistantIds = new Set([
            ...targetState!.damageContributors
              .filter(
                (entry) => this.tick - entry.lastDamageTick <= ASSIST_WINDOW_SECONDS * TICK_RATE
              )
              .map((entry) => entry.sourceId),
            ...targetState!.revealContributors
              .filter(
                (entry) => this.tick - entry.lastRevealTick <= HAWKSHOT_ASSIST_SECONDS * TICK_RATE
              )
              .map((entry) => entry.sourceId),
          ]);
          for (const id of assistantIds) {
            if (id === source.id) continue;
            const contributor = this.unit(id);
            const record = this.championState(id);
            if (record && contributor?.team === source.team) record.assists++;
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
      } else if (
        target.team === 'red' &&
        target.kind === 'champion' &&
        distance(this.hero, target) < 1400
      ) {
        // Champion kill/assist XP remains a separate legacy approximation.
        this.gainExperience(target.experienceBounty ?? 180);
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
      const factor = ASHE.growthFactors[state.level - 1];
      const h = this.unit(championId)!,
        living = this.alive(h);
      const hp = statPrecision(ASHE.hpGrowth * factor),
        mana = statPrecision(ASHE.manaGrowth * factor);
      h.maxHp = statPrecision(h.maxHp + hp);
      h.maxMana = statPrecision(h.maxMana + mana);
      if (living) {
        h.hp = Math.min(h.maxHp, h.hp + hp);
        h.mana = Math.min(h.maxMana, h.mana + mana);
      }
      h.damage = statPrecision(h.damage + ASHE.damageGrowth * factor);
      h.armor = statPrecision(h.armor + ASHE.armorGrowth * factor);
      h.magicResist = statPrecision(h.magicResist + ASHE.magicResistGrowth * factor);
      const speed = 1 + ASHE.attackSpeedGrowth * growthAtLevel(state.level);
      h.attackPeriod = Math.round(TICK_RATE / (ASHE.attackSpeed * speed));
      h.windupTicks = Math.round(20 / speed);
      this.emit('level', h, { text: 'Level up!', unit: h.id, team: h.team });
    }
    if (state.level === MAX_LEVEL) state.xp = 0;
  }
  private respawn(u: Unit): void {
    const state = this.championState(u.id);
    if (state) {
      state.damageContributors = [];
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
    u.respawnTick = null;
    u.releaseTick = null;
    u.stunUntil = 0;
    u.aiRetreating = false;
    u.slowUntil = 0;
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
  private cast(u: Unit, ability: Ability, point: Vec2): void {
    const state = this.championState(u.id);
    if (!state) return;
    if (state.pendingCast && ability !== 'f') return;
    const spec = ABILITIES[ability];
    const fail = (text: string) => this.emit('message', u, { text, unit: u.id, team: u.team });
    if (this.abilityCooldownTicks(ability, u.id) > 0 || (ability === 'e' && state.eCharges === 0)) {
      fail('That spell is not ready yet');
      return;
    }
    if (u.mana < spec.cost) {
      fail('Not enough mana');
      return;
    }
    if (ability === 'q' && state.qStacks < 4) {
      fail('Build 4 Focus with basic attacks');
      return;
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const dir = direction(u, point);
    if (['w', 'r', 'd'].includes(ability) && dir.x === 0 && dir.y === 0) return;
    u.mana -= spec.cost;
    state.cooldowns[ability] = this.tick + spec.cooldown * TICK_RATE;
    if (!spec.preservesRecall) state.recallEnd = null;
    if (ability !== 'f') state.castAnimation = null;
    this.emit('cast', u, { unit: u.id, text: ability, team: u.team });
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
        startTick: this.tick,
        releaseTick: this.tick + timing.castSeconds * TICK_RATE,
        point: { ...point },
        damage:
          ability === 'e'
            ? 0
            : ability === 'r'
              ? 200
              : ASHE_W.baseDamageByRank[0] +
                Math.max(
                  0,
                  u.damage - ASHE.damage - ASHE.damageGrowth * growthAtLevel(state.level)
                ) *
                  ASHE_W.bonusADRatioByRank[0],
      };
    }
    if (ability === 'e') {
      state.eCharges--;
      state.eRechargeTick ??= this.tick + ASHE_E.rechargeSecondsByRank[0] * TICK_RATE;
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
      const levelFraction = Math.max(0, Math.min(1, (state.level - 1) / 17));
      const heal =
        SUMMONER_HEAL.minimumHeal +
        (SUMMONER_HEAL.maximumHeal - SUMMONER_HEAL.minimumHeal) * levelFraction;
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
        const multiplier =
          recipient.summonerHealReductionUntil > this.tick ? SUMMONER_HEAL.repeatHealMultiplier : 1;
        const amount = Math.min(heal * multiplier, recipient.maxHp - recipient.hp);
        recipient.hp += amount;
        recipient.summonerHealReductionUntil =
          this.tick + SUMMONER_HEAL.repeatHealWindowSeconds * TICK_RATE;
        recipient.summonerHealSpeedUntil =
          this.tick + SUMMONER_HEAL.speedDurationSeconds * TICK_RATE;
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
    capturedDamage?: number
  ): void {
    const dir = direction(u, point),
      spec = ABILITIES[ability];
    const volleyId = ability === 'w' ? this.nextId++ : null;
    const number = ability === 'w' ? ASHE_W.arrowsByRank[0] : 1,
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
          capturedDamage ??
          (ability === 'w'
            ? ASHE_W.baseDamageByRank[0] +
              Math.max(
                0,
                u.damage -
                  ASHE.damage -
                  ASHE.damageGrowth * growthAtLevel(this.championState(u.id)?.level ?? 1)
              ) *
                ASHE_W.bonusADRatioByRank[0]
            : 200),
        speed: ability === 'w' ? ASHE_W.projectileSpeed : ASHE_R.initialSpeed,
        radius: ability === 'w' ? 12 : 65,
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
    if (item.id === 'boots' && state.inventory.includes('boots')) return 'You already own boots';
    return null;
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
    let damage: number = item.damage,
      hp: number = item.hp,
      speed: number = item.speed;
    for (const slot of plan.consumed) {
      const component = ITEMS.find((entry) => entry.id === state.inventory[slot])!;
      damage -= component.damage;
      hp -= component.hp;
      speed -= component.speed;
      state.inventory[slot] = null;
    }
    if (emptySlot === -1) state.inventory.push(item.id);
    else state.inventory[emptySlot] = item.id;
    champion.damage += damage;
    champion.maxHp += hp;
    if (this.alive(champion)) champion.hp += hp;
    champion.speed += speed;
    return null;
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
    champion.damage -= item.damage;
    champion.speed -= item.speed;
    champion.maxHp -= item.hp;
    // Local health-removal policy; native missing-health behavior needs calibration.
    if (this.alive(champion))
      champion.hp = Math.min(champion.maxHp, Math.max(1, champion.hp - item.hp));
    return null;
  }
  static fromSnapshot(text: string, battlefield: Battlefield): World {
    const state = decodeSnapshot(text);
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
      randomState: this.random.state,
      wave: this.wave,
      nextWaveTick: this.nextWaveTick,
      reveal: this.reveal,
      visionAreas: this.visionAreas,
      scoutVisuals: this.scoutVisuals,
      volleyHits: this.volleyHits,
      commands: this.commands,
    });
  }
}
