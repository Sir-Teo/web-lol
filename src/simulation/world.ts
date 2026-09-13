import { LANE_END, LANE_START, SPAWN } from '../content/map';
import { ABILITIES, DT, ITEMS, TICK_RATE } from '../content/rules';
import { direction, distance, Random, sweepCircle, type Vec2 } from './math';
import { findPath, reachable } from './navigation';
import type { Ability, Command, Order, PlayerState, Projectile, SimEvent, Team, Unit, UnitKind } from './types';

export class World {
  tick = 0;
  nextId = 1;
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  events: SimEvent[] = [];
  commands: Command[] = [];
  random = new Random(26018);
  player: PlayerState;
  wave = 0;
  nextWaveTick = 5 * TICK_RATE;
  reveal: { point: Vec2; endTick: number } | null = null;
  healSpeedEnd = 0;
  volleyHits: Record<number, number[]> = {};

  constructor(populate = true) {
    const champion = this.spawn('champion', 'blue', SPAWN);
    champion.name = 'Ashe';
    this.player = { id: champion.id, gold: 500, cs: 0, kills: 0, deaths: 0, xp: 0, level: 1,
      cooldowns: { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 }, qStacks: 0, qUntil: 0, qStackExpiry: 0, recallEnd: null, inventory: [] };
    if (populate) {
      const enemy = this.spawn('champion', 'red', { x: 1000, y: -750 });
      enemy.name = 'Sparring partner'; enemy.ai = true;
      this.spawn('turret', 'blue', { x: -2400, y: 1800 });
      this.spawn('turret', 'red', { x: 2400, y: -1800 });
      this.spawn('dummy', 'red', { x: -450, y: 50 });
    }
  }
  get time(): number { return this.tick / TICK_RATE; }
  get hero(): Unit { return this.units.find(u => u.id === this.player.id)!; }
  unit(id: number): Unit | undefined { return this.units.find(u => u.id === id); }
  alive(unit: Unit): boolean { return unit.hp > 0; }
  emit(type: SimEvent['type'], p: Vec2, data: Partial<SimEvent> = {}): void {
    this.events.push({ id: this.nextId++, tick: this.tick, type, x: p.x, y: p.y, ...data });
  }
  spawn(kind: UnitKind, team: Team, point: Vec2): Unit {
    const champion = kind === 'champion', turret = kind === 'turret', dummy = kind === 'dummy';
    const hp = champion ? 610 : turret ? 3500 : dummy ? 1500 : kind === 'siege' ? 900 : kind === 'melee' ? 477 : 296;
    const u: Unit = {
      id: this.nextId++, kind, team, name: champion ? 'Ashe' : turret ? 'Outer turret' : dummy ? 'Target dummy' : `${kind} minion`,
      ...point, previous: { ...point }, facing: team === 'blue' ? 2.2 : -0.95,
      radius: champion ? 35 : turret ? 95 : dummy ? 40 : 27,
      hp, maxHp: hp, mana: champion ? 280 : 0, maxMana: champion ? 280 : 0,
      damage: champion ? 59 : turret ? 150 : kind === 'siege' ? 40 : 24,
      armor: champion ? 26 : turret ? 40 : 0,
      range: champion ? 600 : turret ? 775 : kind === 'melee' ? 110 : 550,
      speed: champion ? 325 : turret || dummy ? 0 : 325,
      attackPeriod: champion ? 91 : turret ? 72 : 80,
      windupTicks: champion ? 20 : turret ? 18 : 22,
      missileSpeed: champion ? 2000 : turret ? 1500 : kind === 'melee' ? 0 : 1200,
      order: { type: 'idle' }, path: [], pathTarget: null,
      attackTarget: null, releaseTick: null, nextAttackTick: 0,
      slowUntil: 0, stunUntil: 0, deadAt: null, ai: !champion && !dummy,
      nextThink: 0, respawnTick: null,
    };
    this.units.push(u); return u;
  }
  enqueue(command: Command): void { this.commands.push(structuredClone(command)); }
  setOrder(u: Unit, order: Order): void {
    u.order = order;
    if (order.type !== 'attack' || order.target !== u.attackTarget) {
      if (u.releaseTick !== null) u.nextAttackTick = Math.min(u.nextAttackTick, this.tick);
      u.releaseTick = null; u.attackTarget = null;
    }
    u.path = []; u.pathTarget = null;
    if (u.id === this.player.id) this.player.recallEnd = null;
  }
  step(count = 1): void {
    for (let i = 0; i < count; i++) this.update();
  }
  private update(): void {
    this.tick++;
    for (const unit of this.units) unit.previous = { x: unit.x, y: unit.y };
    const commands = this.commands.splice(0);
    for (const command of commands) {
      const u = this.unit(command.unit);
      if (!u || !this.alive(u) || u.stunUntil > this.tick) continue;
      if (command.type === 'order') {
        this.setOrder(u, command.order);
        if (command.order.type === 'move' || command.order.type === 'attackMove') this.emit('move', command.order.point);
      } else if (command.type === 'cast') this.cast(u, command.ability, command.point);
      else if (u.id === this.player.id) {
        this.setOrder(u, { type: 'idle' }); this.player.recallEnd = this.tick + 8 * TICK_RATE;
        this.emit('message', u, { text: 'Recalling…' });
      }
    }
    if (this.tick >= this.nextWaveTick) { this.spawnWave(); this.nextWaveTick += 30 * TICK_RATE; }
    for (const u of this.units) {
      if (!this.alive(u)) {
        if (u.respawnTick !== null && this.tick >= u.respawnTick) this.respawn(u);
        continue;
      }
      if (u.stunUntil > this.tick) {
        if (u.releaseTick !== null) { u.releaseTick = null; u.nextAttackTick = this.tick; }
        continue;
      }
      if (u.ai && this.tick >= u.nextThink) { this.think(u); u.nextThink = this.tick + 18; }
      this.advanceUnit(u);
    }
    this.advanceProjectiles();
    const h = this.hero;
    if (this.player.recallEnd !== null && this.tick >= this.player.recallEnd) {
      h.x = SPAWN.x; h.y = SPAWN.y; h.previous = { ...SPAWN }; h.hp = h.maxHp; h.mana = h.maxMana;
      this.player.recallEnd = null; this.emit('heal', h, { value: h.maxHp });
    }
    if (this.alive(h)) {
      const fountain = distance(h, SPAWN) < 220;
      h.hp = Math.min(h.maxHp, h.hp + (fountain ? h.maxHp * .09 : .7) * DT);
      h.mana = Math.min(h.maxMana, h.mana + (fountain ? h.maxMana * .12 : 1.4) * DT);
    }
    if (this.tick % 60 === 0) this.player.gold += 2;
    if (this.tick > this.player.qStackExpiry && this.tick > this.player.qUntil) this.player.qStacks = 0;
    this.events = this.events.filter(e => this.tick - e.tick < 150);
    this.units = this.units.filter(u => u.deadAt === null || u.respawnTick !== null || this.tick - u.deadAt < 90);
    if (this.tick % 120 === 0) for (const key of Object.keys(this.volleyHits)) {
      if (!this.projectiles.some(p => p.volleyId === Number(key))) delete this.volleyHits[Number(key)];
    }
  }
  private spawnWave(): void {
    this.wave++;
    for (const team of ['blue', 'red'] as const) {
      const start = team === 'blue' ? LANE_START : LANE_END;
      const end = team === 'blue' ? LANE_END : LANE_START;
      const dir = direction(start, end);
      const kinds: UnitKind[] = ['melee', 'melee', 'melee', 'caster', 'caster', 'caster'];
      if (this.wave % 3 === 0) kinds.push('siege');
      kinds.forEach((kind, i) => {
        const u = this.spawn(kind, team, { x: start.x - dir.x * i * 100, y: start.y - dir.y * i * 100 });
        u.order = { type: 'attackMove', point: end };
      });
    }
  }
  visible(u: Unit, team: Team = 'blue'): boolean {
    if (u.team === team || u.kind === 'turret') return true;
    if (team === 'blue' && this.reveal && this.reveal.endTick > this.tick && distance(u, this.reveal.point) < 650) return true;
    return this.units.some(ally => ally.team === team && this.alive(ally) && distance(u, ally) < (ally.kind === 'champion' ? 1300 : 1000));
  }
  private validTarget(u: Unit, target: Unit | undefined): target is Unit {
    return !!target && target.team !== u.team && this.alive(target) && this.visible(target, u.team);
  }
  private nearest(u: Unit, range: number): Unit | undefined {
    let best: Unit | undefined, bestDistance = Infinity;
    for (const target of this.units) if (this.validTarget(u, target) && target.kind !== 'dummy') {
      const d = distance(u, target) - target.radius;
      const score = d + (target.kind === 'champion' && u.kind !== 'champion' ? 300 : 0);
      if (d < range && score < bestDistance) { bestDistance = score; best = target; }
    }
    return best;
  }
  private think(u: Unit): void {
    if (u.kind !== 'champion') return;
    if (u.hp < u.maxHp * .22) {
      if (distance(u, LANE_END) < 400) u.hp = Math.min(u.maxHp, u.hp + 20);
      if (u.order.type !== 'move') this.setOrder(u, { type: 'move', point: LANE_END });
      return;
    }
    const target = this.nearest(u, 1150);
    if (target) {
      const d = distance(u, target);
      if (d < 380 && target.kind === 'champion' && this.tick > (u.releaseTick ?? 0)) {
        const away = direction(target, u);
        this.setOrder(u, { type: 'move', point: { x: u.x + away.x * 180, y: u.y + away.y * 180 } });
      } else if (u.order.type !== 'attack' || u.order.target !== target.id) this.setOrder(u, { type: 'attack', target: target.id });
    } else if (u.order.type !== 'move') this.setOrder(u, { type: 'move', point: { x: 650, y: -490 } });
  }
  private advanceUnit(u: Unit): void {
    let target = u.attackTarget === null ? undefined : this.unit(u.attackTarget);
    if (u.releaseTick !== null) {
      if (!this.validTarget(u, target)) { u.releaseTick = null; u.nextAttackTick = this.tick; }
      else {
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
        if (this.tick >= u.releaseTick) {
          u.releaseTick = null;
          this.emit('attack', u, { unit: u.id, team: u.team });
          if (!u.missileSpeed) this.damage(u, target, u.damage, 'physical');
          else this.projectiles.push({ id: this.nextId++, x: u.x, y: u.y, previous: { x: u.x, y: u.y }, source: u.id, team: u.team,
            type: 'attack', target: target.id, direction: direction(u, target), damage: u.damage,
            speed: u.missileSpeed, radius: 8, remaining: 4000, volleyId: null });
        }
        return;
      }
    }
    if (u.order.type === 'attack') {
      const ordered = this.unit(u.order.target);
      target = this.validTarget(u, ordered) ? ordered : undefined;
      if (!target) this.setOrder(u, { type: 'idle' });
    } else if (u.order.type === 'attackMove' || u.kind === 'turret') target = this.nearest(u, u.kind === 'turret' ? u.range : 650);
    else target = undefined;
    if (target) {
      const inRange = distance(u, target) <= u.range + target.radius;
      if (inRange) {
        u.facing = Math.atan2(target.x - u.x, target.y - u.y);
        if (this.tick >= u.nextAttackTick) {
          const boosted = u.id === this.player.id && this.player.qUntil > this.tick;
          u.attackTarget = target.id;
          u.releaseTick = this.tick + Math.round(u.windupTicks / (boosted ? 1.4 : 1));
          u.nextAttackTick = this.tick + Math.round(u.attackPeriod / (boosted ? 1.4 : 1));
        }
        return;
      }
      if (u.kind !== 'turret') this.move(u, target);
    } else if (u.order.type === 'move' || u.order.type === 'attackMove') {
      this.move(u, u.order.point);
      if (distance(u, reachable(u.order.point, u.radius)) < 3 && u.order.type === 'move') u.order = { type: 'idle' };
    }
  }
  private move(u: Unit, point: Vec2): void {
    if (!u.speed) return;
    if (!u.pathTarget || distance(u.pathTarget, point) > 90 || !u.path.length) {
      u.path = findPath(u, point, u.radius); u.pathTarget = { x: point.x, y: point.y };
    }
    const waypoint = u.path[0];
    if (!waypoint) return;
    const dir = direction(u, waypoint), d = distance(u, waypoint);
    const haste = u.id === this.player.id && this.healSpeedEnd > this.tick ? 1.3 : 1;
    const amount = Math.min(d, u.speed * DT * (u.slowUntil > this.tick ? .7 : 1) * haste);
    u.x += dir.x * amount; u.y += dir.y * amount; u.facing = Math.atan2(dir.x, dir.y);
    if (d <= amount + .01) u.path.shift();
  }
  private advanceProjectiles(): void {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      p.previous = { x: p.x, y: p.y };
      const source = this.unit(p.source);
      const target = p.target === null ? undefined : this.unit(p.target);
      if (p.target !== null) {
        if (!target || !this.alive(target)) continue;
        p.direction = direction(p, target);
      }
      const travel = Math.min(p.speed * DT, p.remaining);
      const end = { x: p.x + p.direction.x * travel, y: p.y + p.direction.y * travel };
      let contact: Unit | undefined, first = Infinity;
      for (const u of this.units) {
        if (!this.alive(u) || u.team === p.team) continue;
        if (p.target !== null && u.id !== p.target) continue;
        if (p.type === 'ultimate' && u.kind !== 'champion' && u.kind !== 'dummy') continue;
        if (p.type !== 'attack' && u.kind === 'turret') continue;
        const t = sweepCircle(p, end, u, p.radius + u.radius);
        if (t !== null && t < first) { contact = u; first = t; }
      }
      if (contact) {
        if (source && (p.volleyId === null || !this.volleyHits[p.volleyId]?.includes(contact.id))) {
          if (p.volleyId !== null) (this.volleyHits[p.volleyId] ??= []).push(contact.id);
          this.damage(source, contact, p.damage, p.type === 'ultimate' ? 'magic' : 'physical');
          if (source.kind === 'champion') contact.slowUntil = this.tick + 120;
          if (p.type === 'ultimate') contact.stunUntil = this.tick + 120;
          if (source.id === this.player.id && p.type === 'attack') {
            this.player.qStacks = Math.min(4, this.player.qStacks + 1); this.player.qStackExpiry = this.tick + 240;
          }
        }
      } else if (p.remaining > travel) { p.x = end.x; p.y = end.y; p.remaining -= travel; survivors.push(p); }
    }
    this.projectiles = survivors;
  }
  damage(source: Unit, target: Unit, raw: number, kind: 'physical' | 'magic' | 'true'): void {
    if (!this.alive(target)) return;
    const resistance = kind === 'physical' ? target.armor : kind === 'magic' ? 30 : 0;
    const amount = raw * 100 / (100 + resistance);
    target.hp = Math.max(0, target.hp - amount);
    this.emit('damage', target, { unit: target.id, value: Math.round(amount), team: source.team });
    if (target.id === this.player.id) this.player.recallEnd = null;
    if (target.kind === 'champion') for (const turret of this.units) {
      if (turret.kind === 'turret' && turret.team === target.team && this.alive(turret) && distance(turret, source) <= turret.range) turret.order = { type: 'attack', target: source.id };
    }
    if (target.hp === 0) {
      target.deadAt = this.tick; target.releaseTick = null; target.order = { type: 'idle' };
      this.emit('death', target, { unit: target.id });
      if (target.kind === 'champion') target.respawnTick = this.tick + 10 * TICK_RATE;
      if (target.kind === 'dummy') target.respawnTick = this.tick + 3 * TICK_RATE;
      if (target.id === this.player.id) { this.player.deaths++; this.player.recallEnd = null; }
      if (source.id === this.player.id) {
        const gold = target.kind === 'champion' ? 300 : target.kind === 'dummy' ? 0 : target.kind === 'turret' ? 250 : target.kind === 'siege' ? 60 : target.kind === 'melee' ? 21 : 14;
        this.player.gold += gold;
        if (gold) this.emit('gold', target, { value: gold });
        if (target.kind === 'champion') this.player.kills++;
        else if (target.kind !== 'dummy' && target.kind !== 'turret') this.player.cs++;
      }
      if (target.team === 'red' && target.kind !== 'dummy' && distance(this.hero, target) < 1400) {
        this.player.xp += target.kind === 'champion' ? 180 : 60;
        const needed = 280 + (this.player.level - 1) * 100;
        if (this.player.xp >= needed && this.player.level < 18) {
          this.player.xp -= needed; this.player.level++;
          this.hero.maxHp += 90; this.hero.hp += 90; this.hero.damage += 3;
          this.emit('level', this.hero, { text: 'Level up!' });
        }
      }
    }
  }
  private respawn(u: Unit): void {
    const point = u.id === this.player.id ? SPAWN : u.kind === 'dummy' ? { x: u.x, y: u.y } : LANE_END;
    u.x = point.x; u.y = point.y; u.previous = { ...point }; u.hp = u.maxHp; u.mana = u.maxMana;
    u.deadAt = null; u.respawnTick = null; u.releaseTick = null; u.stunUntil = 0; u.slowUntil = 0;
    this.setOrder(u, { type: 'idle' });
  }
  private cast(u: Unit, ability: Ability, point: Vec2): void {
    if (u.id !== this.player.id) return;
    const spec = ABILITIES[ability];
    const fail = (text: string) => this.emit('message', u, { text });
    if (this.player.cooldowns[ability] > this.tick) { fail('That spell is not ready yet'); return; }
    if (u.mana < spec.cost) { fail('Not enough mana'); return; }
    if (ability === 'q' && this.player.qStacks < 4) { fail('Build 4 Focus with basic attacks'); return; }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const dir = direction(u, point);
    if (['w', 'r', 'd'].includes(ability) && dir.x === 0 && dir.y === 0) return;
    u.mana -= spec.cost; this.player.cooldowns[ability] = this.tick + spec.cooldown * TICK_RATE;
    this.player.recallEnd = null;
    this.emit('cast', u, { unit: u.id, text: ability, team: u.team });
    if (ability === 'q') { this.player.qStacks = 0; this.player.qUntil = this.tick + 240; }
    if (ability === 'w' || ability === 'r') {
      const volleyId = ability === 'w' ? this.nextId++ : null;
      const number = ability === 'w' ? 9 : 1, angle = Math.atan2(dir.y, dir.x);
      if (volleyId !== null) this.volleyHits[volleyId] = [];
      for (let i = 0; i < number; i++) {
        const a = angle + (number === 1 ? 0 : (i / (number - 1) - .5) * .8);
        this.projectiles.push({ id: this.nextId++, x: u.x, y: u.y, previous: { x: u.x, y: u.y }, source: u.id, team: u.team,
          type: ability === 'w' ? 'volley' : 'ultimate', target: null, direction: { x: Math.cos(a), y: Math.sin(a) },
          damage: ability === 'w' ? 20 + u.damage : 200, speed: ability === 'w' ? 1800 : 1600,
          radius: ability === 'w' ? 12 : 65, remaining: spec.range, volleyId });
      }
    }
    if (ability === 'e') this.reveal = { point: { ...point }, endTick: this.tick + 300 };
    if (ability === 'd') {
      const d = Math.min(spec.range, distance(u, point));
      const end = reachable({ x: u.x + dir.x * d, y: u.y + dir.y * d }, u.radius);
      u.x = end.x; u.y = end.y; u.previous = { ...end }; this.setOrder(u, { type: 'idle' });
    }
    if (ability === 'f') { const amount = Math.min(100 + this.player.level * 10, u.maxHp - u.hp); u.hp += amount; this.healSpeedEnd = this.tick + 60; this.emit('heal', u, { value: Math.round(amount) }); }
  }
  buy(itemId: string): string | null {
    const item = ITEMS.find(i => i.id === itemId);
    if (!item) return 'Unknown item';
    if (distance(this.hero, SPAWN) > 400 && this.hero.hp > 0) return 'Return to your fountain to purchase items';
    if (this.player.inventory.length >= 6) return 'Inventory is full';
    if (this.player.gold < item.price) return 'Not enough gold';
    if (item.id === 'boots' && this.player.inventory.includes('boots')) return 'You already own boots';
    this.player.gold -= item.price; this.player.inventory.push(item.id);
    this.hero.damage += item.damage; this.hero.maxHp += item.hp; this.hero.hp += item.hp; this.hero.speed += item.speed;
    return null;
  }
  snapshot(): string {
    return JSON.stringify({ version: 1, tick: this.tick, nextId: this.nextId, units: this.units, player: this.player,
      projectiles: this.projectiles, randomState: this.random.state, wave: this.wave, nextWaveTick: this.nextWaveTick,
      reveal: this.reveal, healSpeedEnd: this.healSpeedEnd, volleyHits: this.volleyHits, commands: this.commands });
  }
}
