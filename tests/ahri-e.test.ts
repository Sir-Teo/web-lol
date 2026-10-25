import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_E } from '../src/content/ahri-e';
import { AHRI_E_POLICY } from '../src/content/ahri-e-policy';
import { GROMP_SPAWN_LEADUP_TICKS } from '../src/content/gromp';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  w.hero.ai = false;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const state = w.championState(ahri.id)!;
  expect(w.learnSpell('e', ahri.id)).toBeNull();
  const target = (x = 500, y = 0) => {
    const u = w.spawn('champion', 'red', { x, y }, 'lux');
    u.ai = false;
    u.hp = u.maxHp = 10000;
    u.magicResist = 0;
    return u;
  };
  const cast = (point = { x: 900, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point });
    w.step();
  };
  const restore = () => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    return copy;
  };
  return { w, ahri, state, target, cast, restore };
}

test('Charm owns its metadata, resources, fifteen-tick windup and child missile declarations', () => {
  const { w, ahri, state, cast, restore } = setup();
  const mana = ahri.mana;
  cast();
  expect(w.abilitySpec('e', ahri.id)).toMatchObject({ name: 'Charm', icon: 'AhriE', range: 975 });
  expect(ahri.mana).toBeLessThan(mana - 59);
  expect(state.cooldowns.e).toBe(w.tick + 720);
  expect(state.pendingCast?.releaseTick).toBe(w.tick + 15);
  expect(w.projectiles).toEqual([]);
  restore();
  w.step(14);
  expect(w.projectiles).toEqual([]);
  w.step();
  expect(w.projectiles[0]).toMatchObject({
    type: 'charm',
    charmRank: 1,
    speed: 1550,
    radius: 60,
    remaining: 1000 - 1550 / 60,
  });
  expect(w.projectiles[0].x).toBeCloseTo(1550 / 60, 9);
  restore();
  w.step(38);
  expect(w.projectiles).toHaveLength(0);
  expect(state.eCharges).toBe(0);
});

test('all ranks capture their own magic payload and sampled forced-walk duration', () => {
  for (let rank = 1; rank <= 5; rank++) {
    const { w, ahri, state, cast } = setup();
    w.gainExperience(1e6, ahri.id);
    while (state.spellRanks.e < rank) expect(w.learnSpell('e', ahri.id)).toBeNull();
    state.inventory = ['tome'];
    const ap = w.abilityPower(ahri),
      victim = w.spawn('dummy', 'red', { x: 500, y: 0 });
    victim.hp = victim.maxHp = 10000;
    victim.magicResist = 0;
    cast();
    state.inventory = [];
    while (!victim.charm) w.step();
    expect(victim.maxHp - victim.hp).toBeCloseTo(
      AHRI_E.damageByRank[rank - 1] + AHRI_E.abilityPowerRatio * ap,
      7
    );
    expect(victim.charm).toMatchObject({ sourceId: ahri.id, rank, tenacityApplied: false });
    expect(victim.charm!.endTick - victim.charm!.startTick).toBe(
      Math.round(AHRI_E.charmSecondsByRank[rank - 1] * 60)
    );
  }
});

test('a swept first enemy hit stops Charm even when a later target is a champion', () => {
  const { w, target, cast } = setup();
  const front = w.spawn('dummy', 'red', { x: 250, y: 0 }),
    back = target(500);
  front.hp = front.maxHp = 10000;
  front.magicResist = 0;
  cast();
  w.step(60);
  expect(front.maxHp - front.hp).toBe(80);
  expect(front.charm).not.toBeNull();
  expect(back.hp).toBe(back.maxHp);
  expect(back.charm).toBeNull();
  expect(w.projectiles).toEqual([]);
});

test('equal sweep contacts use stable unit IDs independently of array ordering', () => {
  const { w, target, cast } = setup(),
    a = target(),
    b = target();
  w.units.reverse();
  cast();
  w.step(40);
  expect(a.charm).not.toBeNull();
  expect(b.charm).toBeNull();
});

test('allies, structures, wards and protected emergence do not consume Charm', () => {
  const { w, target, cast } = setup();
  w.spawn('dummy', 'blue', { x: 150, y: 0 });
  w.spawn('turret', 'red', { x: 220, y: 0 });
  const monster = w.spawnMonster(
    { x: 300, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  const victim = target(700);
  cast();
  w.step(48);
  expect(victim.charm).not.toBeNull();
  expect(monster.hp).toBe(monster.maxHp);
  expect(monster.charm).toBeNull();
});

test('Charm passes terrain, uses the declared width as a local collision radius, and expires at range', () => {
  const { w, target, cast } = setup();
  w.battlefield.lineWalkable = () => false;
  const outside = target(400, 60 + 65 + 1);
  outside.radius = 65;
  const within = target(700, 124);
  within.radius = 65;
  cast({ x: 1, y: 0 });
  w.step(50);
  expect(outside.charm).toBeNull();
  expect(within.charm).not.toBeNull();
  const f = setup();
  f.target(1200);
  f.cast();
  f.w.step(60);
  expect(f.w.projectiles).toEqual([]);
});

test('forced walking follows the living caster and its corpse, ends exactly, and does not leave an order', () => {
  const { w, ahri, target, restore } = setup(),
    victim = target(700);
  w.applyCharm(ahri, victim, 1);
  const initial = victim.x;
  w.step(10);
  expect(victim.x).toBeLessThan(initial);
  expect(w.slowFactor(victim)).toBe(AHRI_E_POLICY.movementMultiplier);
  ahri.y = 300;
  w.step(3);
  expect(victim.y).toBeGreaterThan(0);
  w.damage(w.hero, ahri, 1e6, 'true');
  const y = victim.y;
  w.step(3);
  expect(victim.y).toBeGreaterThan(y);
  restore();
  const deadline = victim.charm!.endTick;
  w.step(deadline - w.tick - 1);
  expect(victim.charm).not.toBeNull();
  w.step();
  expect(victim.charm).toBeNull();
  expect(victim.order.type).toBe('idle');
  expect(victim.path).toEqual([]);
  expect(w.slowFactor(victim)).toBe(1);
});

test('root and stun suspend forced walking without replacing or extending Charm', () => {
  const { w, ahri, target } = setup(),
    victim = target();
  w.applyCharm(ahri, victim, 1);
  const deadline = victim.charm!.endTick;
  w.applyRoot(victim, 10);
  const x = victim.x;
  w.step(9);
  expect(victim.x).toBe(x);
  w.step(2);
  expect(victim.x).toBeLessThan(x);
  w.applyStun(victim, 10);
  const stopped = victim.x;
  w.step(9);
  expect(victim.x).toBe(stopped);
  w.step(2);
  expect(victim.x).toBeLessThan(stopped);
  expect(victim.charm!.endTick).toBe(deadline);
});

test('Charm rejects orders, recall, new attacks, warding and spells while retaining permitted Heal', () => {
  const { w, ahri, target } = setup(),
    victim = target();
  const owner = w.championState(victim.id)!;
  w.learnSpell('q', victim.id);
  victim.hp = 5000;
  const mana = victim.mana;
  w.applyCharm(ahri, victim, 1);
  const heal = w.summonerSlot('heal', victim.id)!;
  expect(heal).toBeDefined();
  for (const command of [
    { type: 'order', unit: victim.id, order: { type: 'attack', target: ahri.id } },
    { type: 'recall', unit: victim.id },
    { type: 'ward', unit: victim.id, point: { x: 200, y: 0 } },
    { type: 'cast', unit: victim.id, ability: 'q', point: { x: 0, y: 0 } },
    { type: 'cast', unit: victim.id, ability: heal, point: { x: 500, y: 0 } },
  ] as const)
    w.enqueue(command);
  w.step();
  expect(victim.hp).toBeGreaterThan(5000);
  expect(victim.mana).toBeGreaterThanOrEqual(mana);
  expect(owner.cooldowns.q).toBe(0);
  expect(owner.recallEnd).toBeNull();
  expect(victim.releaseTick).toBeNull();
  expect(w.units.some((u) => u.kind === 'ward')).toBe(false);
  expect(owner.cooldowns[heal]).toBeGreaterThan(w.tick);
});

test('an accepted non-channel cast completes under Charm; a normal unreleased attack is cancelled', () => {
  const { w, ahri, target } = setup(),
    victim = target();
  w.learnSpell('q', victim.id);
  w.enqueue({ type: 'cast', unit: victim.id, ability: 'q', point: { x: 0, y: 0 } });
  w.step();
  const release = w.championState(victim.id)!.pendingCast!.releaseTick;
  w.applyCharm(ahri, victim, 1);
  w.step(release - w.tick);
  expect(w.projectiles.some((p) => p.type === 'binding')).toBe(true);
  const f = setup(),
    attacker = f.target(300);
  f.w.setOrder(attacker, { type: 'attack', target: f.ahri.id });
  f.w.step();
  expect(attacker.releaseTick).not.toBeNull();
  f.w.applyCharm(f.ahri, attacker, 1);
  expect(attacker.releaseTick).toBeNull();
  expect(attacker.attackCycle).toBeNull();
});

test('Courage samples tenacity once and keeps that sampled duration after its upfront window', () => {
  const { w, ahri, restore } = setup();
  const garen = w.spawn('champion', 'red', { x: 500, y: 0 }, 'garen');
  garen.ai = false;
  w.learnSpell('w', garen.id);
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'w', point: { x: 500, y: 0 } });
  w.step(40);
  expect(w.applyCharm(ahri, garen, 1)).toBe(true);
  expect(garen.charm!.endTick - garen.charm!.startTick).toBe(29);
  expect(garen.charm!.tenacityApplied).toBe(true);
  w.step(10);
  restore();
  expect(garen.charm).not.toBeNull();
  w.step(19);
  expect(garen.charm).toBeNull();
});

test('death clears target Charm and lethal first-hit damage does not attach control', () => {
  const { w, target, cast, restore } = setup(),
    victim = target();
  victim.hp = 10;
  cast();
  w.step(40);
  expect(victim.hp).toBe(0);
  expect(victim.charm).toBeNull();
  restore();
  const f = setup(),
    t = f.target();
  f.w.applyCharm(f.ahri, t, 1);
  f.w.damage(f.ahri, t, 1e6, 'true');
  expect(t.charm).toBeNull();
});

test('windup, flight, impact and forced-walk saves have identical 300-tick futures', () => {
  for (const ticks of [1, 16, 25, 40, 70]) {
    const { w, target, cast, restore } = setup();
    target();
    cast();
    w.step(ticks - 1);
    const copy = restore();
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('malformed Charm flights and control reject edited saves', () => {
  const f = setup();
  f.target();
  f.cast();
  f.w.step(15);
  const raw = JSON.parse(f.w.snapshot());
  for (const mutate of [
    (p: any) => p.speed++,
    (p: any) => p.radius++,
    (p: any) => (p.charmRank = 5),
    (p: any) => (p.direction.x = 0.5),
    (p: any) => p.x++,
    (p: any) => p.remaining++,
    (p: any) => p.launchTick++,
    (p: any) => p.origin.y++,
    (p: any) => p.previous.x++,
    (p: any) => (p.damage = 0),
    (p: any) => (p.bindingHits = []),
    (p: any) => (p.target = f.ahri.id),
  ]) {
    const bad = structuredClone(raw);
    mutate(bad.projectiles[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), f.w.battlefield)).toThrow();
  }
  f.w.step(15);
  expect(f.w.units.some((u) => u.charm)).toBe(true);
  const controlled = JSON.parse(f.w.snapshot());
  for (const mutate of [
    (c: any) => c.endTick++,
    (c: any) => (c.rank = 5),
    (c: any) => (c.sourceId = f.w.hero.id),
    (c: any) => c.startTick++,
    (c: any) => (c.tenacityApplied = true),
  ]) {
    const bad = structuredClone(controlled);
    mutate(bad.units.find((u: any) => u.charm).charm);
    expect(() => World.fromSnapshot(JSON.stringify(bad), f.w.battlefield)).toThrow();
  }
});

test('Charm stops an active Zenith dash with an honest saved control cause', () => {
  const { w, ahri, restore } = setup();
  ahri.x = 800;
  const leona = w.spawn('champion', 'red', { x: 0, y: 0 }, 'leona');
  leona.ai = false;
  w.learnSpell('e', leona.id);
  w.enqueue({ type: 'cast', unit: leona.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const state = w.championState(leona.id)!;
  while (!state.leonaDash) w.step();
  w.step(2);
  expect(state.leonaDash).not.toBeNull();
  w.applyCharm(ahri, leona, 1);
  expect(state.leonaDash).toBeNull();
  const dash = state.leonaEVisuals[0].dash!;
  expect(dash.endReason).toBe('control');
  expect(dash.stopCause!.charmUntil).toBe(leona.charm!.endTick);
  expect(dash.stopCause!.rootUntil).toBeLessThanOrEqual(w.tick);
  expect(dash.stopCause!.stunUntil).toBeLessThanOrEqual(w.tick);
  const copy = restore();
  w.step(100);
  copy.step(100);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('an empowered Decisive Strike completes under Charm without allowing a new attack', () => {
  const { w, ahri, restore } = setup();
  const garen = w.spawn('champion', 'red', { x: 150, y: 0 }, 'garen');
  garen.ai = false;
  w.learnSpell('q', garen.id);
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: { x: 0, y: 0 } });
  w.setOrder(garen, { type: 'attack', target: ahri.id });
  w.step();
  expect(garen.attackCycle?.garenQRank).toBe(1);
  const release = garen.releaseTick!,
    hp = ahri.hp;
  w.applyCharm(ahri, garen, 1);
  expect(garen.releaseTick).toBe(release);
  restore();
  w.step(release - w.tick);
  expect(ahri.hp).toBeLessThan(hp);
  expect(garen.releaseTick).toBeNull();
  w.step(10);
  expect(garen.releaseTick).toBeNull();
});

test('a vulnerable jungle monster walks under Charm before resuming its own decisions', () => {
  const { w, ahri, restore } = setup();
  const monster = w.spawnMonster({ x: 600, y: 0 });
  w.applyCharm(ahri, monster, 1);
  const x = monster.x;
  w.step(5);
  expect(monster.x).toBeLessThan(x);
  restore();
  w.step(monster.charm!.endTick - w.tick);
  expect(monster.charm).toBeNull();
});

test('latest Charm replaces its source and sampled clock; invalid recipients reject control', () => {
  const { w, ahri, target, restore } = setup(),
    victim = target();
  w.applyCharm(ahri, victim, 1);
  w.step(10);
  const other = w.spawn('champion', 'blue', { x: 0, y: 400 }, 'ahri');
  other.ai = false;
  w.learnSpell('e', other.id);
  w.applyCharm(other, victim, 1);
  expect(victim.charm).toMatchObject({
    sourceId: other.id,
    startTick: w.tick,
    endTick: w.tick + 72,
  });
  restore();
  expect(w.applyCharm(ahri, w.hero, 1)).toBe(false);
  expect(w.applyCharm(ahri, victim, 5)).toBe(false);
  expect(w.applyCharm(w.hero, victim, 1)).toBe(false);
  const protectedMonster = w.spawnMonster(
    { x: 200, y: 0 },
    { startTick: w.tick, readyTick: w.tick + GROMP_SPAWN_LEADUP_TICKS }
  );
  expect(w.applyCharm(ahri, protectedMonster, 1)).toBe(false);
});

test('a returning monster cannot consume Charm or receive its control', () => {
  const { w, ahri, target, cast } = setup(),
    monster = w.spawnMonster({ x: 250, y: 0 }),
    victim = target(700);
  monster.monster.phase = 'returning';
  monster.x = 300;
  w.setOrder(monster, {
    type: 'move',
    point: { x: monster.monster.home.x, y: monster.monster.home.y },
  });
  // Keep the reset in progress across the missile sweep without changing its targetability policy.
  monster.speed = 0;
  cast();
  w.step(47);
  expect(monster.monster.phase).toBe('returning');
  expect(monster.charm).toBeNull();
  expect(victim.charm).not.toBeNull();
  expect(w.applyCharm(ahri, monster, 1)).toBe(false);
});

test('walls can prevent forced walking while its control deadline still advances', () => {
  const { w, ahri, target } = setup(),
    victim = target();
  let paths = 0;
  w.battlefield.findPath = () => {
    paths++;
    return [];
  };
  w.applyCharm(ahri, victim, 1);
  const x = victim.x;
  w.step(72);
  expect(paths).toBeGreaterThan(0);
  expect(victim.x).toBe(x);
  expect(victim.charm).toBeNull();
});

test('stun and silence prevent accepting Charm; root permits this non-mobility spell', () => {
  for (const key of ['stunUntil', 'silenceUntil'] as const) {
    const f = setup();
    f.ahri[key] = 100;
    const mana = f.ahri.mana;
    f.cast();
    expect(f.state.pendingCast).toBeNull();
    expect(f.state.cooldowns.e).toBe(0);
    expect(f.ahri.mana).toBeGreaterThanOrEqual(mana);
  }
  const f = setup();
  f.ahri.rootUntil = 100;
  f.cast();
  expect(f.state.pendingCast?.ability).toBe('e');
});

test('accepted Charm releases through later stun, death cancels its windup, and launched flights outlive the caster', () => {
  const f = setup(),
    victim = f.target();
  f.cast();
  f.w.applyStun(f.ahri, 60);
  f.w.step(40);
  expect(victim.charm).not.toBeNull();
  f.restore();
  const cancelled = setup();
  cancelled.cast();
  cancelled.w.damage(cancelled.w.hero, cancelled.ahri, 1e6, 'true');
  cancelled.w.step(20);
  expect(cancelled.w.projectiles).toEqual([]);
  expect(cancelled.state.pendingCast).toBeNull();
  const flying = setup(),
    t = flying.target();
  flying.cast();
  flying.w.step(15);
  flying.w.damage(flying.w.hero, flying.ahri, 1e6, 'true');
  flying.restore();
  flying.w.step(20);
  expect(t.charm).not.toBeNull();
  flying.restore();
});

test('controlled terminal settlement clears Charm and its flight and freezes the restored match', () => {
  const { w, ahri, target, cast, restore } = setup();
  const victim = target();
  w.applyCharm(ahri, victim, 1);
  cast();
  w.step(15);
  expect(w.projectiles.some((p) => p.type === 'charm')).toBe(true);
  const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(victim.charm).toBeNull();
  expect(w.projectiles).toEqual([]);
  const copy = restore(),
    saved = w.snapshot();
  w.step(100);
  copy.step(100);
  expect(w.snapshot()).toBe(saved);
  expect(copy.snapshot()).toBe(saved);
});
