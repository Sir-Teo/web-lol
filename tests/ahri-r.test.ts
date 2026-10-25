import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_R } from '../src/content/ahri-r';
import { GROMP_SPAWN_LEADUP_TICKS } from '../src/content/gromp';
import { activeSpiritRush, activeSpiritDash } from '../src/simulation/ahri-spirit-rush';

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
  w.hero.ai = false;
  w.hero.x = w.hero.y = -3000;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.gainExperience(1e6, ahri.id);
  const state = w.championState(ahri.id)!;
  expect(w.learnSpell('r', ahri.id)).toBeNull();
  const target = (x = 400, y = 0) => {
    const u = w.spawn('dummy', 'red', { x, y });
    u.hp = u.maxHp = 10000;
    u.magicResist = 0;
    return u;
  };
  const cast = (point = { x: 900, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point });
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

test('R owns level gates, metadata and resources without inheriting child cast time', () => {
  const { w, ahri, state, cast, restore } = setup();
  const mana = ahri.mana;
  cast();
  expect(w.abilitySpec('r', ahri.id)).toMatchObject({
    name: 'Spirit Rush',
    icon: 'AhriR',
    range: 450,
    cantCastWhileRooted: true,
  });
  expect(state.pendingCast).toBeNull();
  expect(ahri.mana).toBeLessThan(mana - 99);
  expect(state.cooldowns.r).toBe(w.tick + 140 * 60);
  expect(w.ahriRushes[0]).toMatchObject({
    remainingCasts: 2,
    endTick: w.tick + 900,
    nextCastTick: w.tick + 60,
  });
  expect(ahri.x).toBe(20);
  restore();
  w.step(24);
  expect(ahri.x).toBe(500);
  expect(activeSpiritDash(w, ahri.id)).toBeUndefined();
  expect(w.ahriRushes[0].bursts[0].stopReason).toBe('arrived');
  restore();
});

test('three casts share a fixed window; recasts are free and retain a one-second lockout', () => {
  const { w, ahri, state, cast, restore } = setup();
  cast();
  const firstMana = ahri.mana,
    cooldown = state.cooldowns.r,
    windowEnd = w.ahriRushes[0].endTick;
  w.step(59);
  expect(w.abilityCooldownTicks('r', ahri.id)).toBe(1);
  cast({ x: 500, y: 500 });
  expect(w.ahriRushes[0].bursts).toHaveLength(2);
  expect(w.abilityResources('r', ahri.id)).toEqual({ mana: 0, cooldownSeconds: 1 });
  expect(ahri.mana).toBeGreaterThan(firstMana);
  expect(state.cooldowns.r).toBe(cooldown);
  restore();
  w.step(59);
  cast({ x: 0, y: 500 });
  expect(w.ahriRushes[0].bursts).toHaveLength(3);
  expect(w.ahriRushes[0].remainingCasts).toBe(0);
  expect(w.ahriRushes[0].endTick).toBe(windowEnd);
  restore();
  w.step(60);
  cast();
  expect(w.ahriRushes[0].bursts).toHaveLength(3);
  w.step(windowEnd - w.tick);
  expect(activeSpiritRush(w, ahri.id)).toBeUndefined();
  expect(w.ahriRushes).toEqual([]);
  restore();
});

test('bolts prioritize distinct visible champions over closer minions and break ties by ID', () => {
  const { w, ahri, target, cast, restore } = setup();
  const near = target(100),
    a = w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux'),
    b = w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux'),
    c = w.spawn('champion', 'red', { x: 550, y: 0 }, 'garen');
  for (const u of [a, b, c]) u.ai = false;
  w.units.reverse();
  cast();
  expect(w.ahriRushes[0].bursts[0].bolts.map((p) => p.targetId)).toEqual([a.id, b.id, c.id]);
  restore();
  w.step(60);
  expect(near.hp).toBe(near.maxHp);
  expect(ahri.x).toBe(500);
  expect(w.ahriRushes[0].bursts[0].bolts.every((p) => p.stopReason === 'hit')).toBe(true);
});

test('every rank captures its payload and AP at each accepted cast', () => {
  for (let rank = 1; rank <= 3; rank++) {
    const { w, ahri, state, target, cast, restore } = setup();
    while (state.spellRanks.r < rank) expect(w.learnSpell('r', ahri.id)).toBeNull();
    state.inventory = ['tome'];
    const ap = w.abilityPower(ahri),
      victim = target();
    cast();
    state.inventory = [];
    w.step(30);
    expect(victim.maxHp - victim.hp).toBeCloseTo(
      AHRI_R.damageByRank[rank - 1] + AHRI_R.abilityPowerRatio * ap,
      7
    );
    restore();
  }
});

test('a near aim uses a short dash; distant aim clamps to 500 and traverses terrain', () => {
  const f = setup();
  f.cast({ x: 100, y: 0 });
  f.w.step(4);
  expect(f.ahri.x).toBe(100);
  f.restore();
  const far = setup();
  far.w.battlefield.lineWalkable = () => false;
  far.w.battlefield.findPath = () => {
    throw Error('dash used walk path');
  };
  far.cast();
  far.w.step(24);
  expect(far.ahri.x).toBe(500);
  far.restore();
});

test('root, stun and Charm immediately interrupt an active dash with saved control facts', () => {
  for (const kind of ['root', 'stun', 'charm'] as const) {
    const { w, ahri, cast, restore } = setup();
    cast();
    w.step(4);
    const x = ahri.x;
    if (kind === 'root') w.applyRoot(ahri, 60);
    if (kind === 'stun') w.applyStun(ahri, 60);
    if (kind === 'charm') {
      const enemy = w.spawn('champion', 'red', { x: 800, y: 0 }, 'ahri');
      enemy.ai = false;
      w.learnSpell('e', enemy.id);
      w.applyCharm(enemy, ahri, 1);
    }
    expect(activeSpiritDash(w, ahri.id)).toBeUndefined();
    expect(w.ahriRushes[0].bursts[0].stopReason).toBe('control');
    restore();
    if (kind !== 'charm') {
      w.step(3);
      expect(ahri.x).toBe(x);
    }
  }
});

test('new rooted/stunned/silenced casts and zero direction cannot spend R resources', () => {
  for (const key of ['rootUntil', 'stunUntil', 'silenceUntil'] as const) {
    const f = setup();
    f.ahri[key] = 100;
    f.cast();
    expect(f.w.ahriRushes).toEqual([]);
    expect(f.state.cooldowns.r).toBe(0);
  }
  const f = setup();
  f.cast({ x: 0, y: 0 });
  expect(f.w.ahriRushes).toEqual([]);
  expect(f.state.cooldowns.r).toBe(0);
});

test('death ends the recast window and dash while already fired bolts keep their captured payload', () => {
  const { w, ahri, target, cast, restore } = setup(),
    victim = target(600);
  cast();
  w.damage(w.hero, ahri, 1e6, 'true');
  expect(activeSpiritDash(w, ahri.id)).toBeUndefined();
  expect(activeSpiritRush(w, ahri.id)).toBeUndefined();
  restore();
  w.step(40);
  expect(victim.maxHp - victim.hp).toBe(75);
  expect(w.ahriRushes).toEqual([]);
  restore();
});

test('dash, recovery, recast and expired-window saves retain exact 300-tick futures', () => {
  for (const age of [1, 10, 25, 59, 100, 900]) {
    const { w, target, cast, restore } = setup();
    target();
    cast();
    w.step(age - 1);
    const copy = restore();
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('endpoint correction backs off deterministically without extending the named dash distance', () => {
  const { w, ahri, cast, restore } = setup();
  let corrected = 0;
  w.battlefield.reachable = (p) => {
    corrected++;
    return { x: p.x + (p.x > 200 ? 1000 : 0), y: p.y };
  };
  cast();
  w.step(9);
  expect(ahri.x).toBe(200);
  expect(corrected).toBeGreaterThan(30);
  restore();
  const invalid = setup();
  invalid.w.battlefield.reachable = (p) => ({ x: p.x + 1000, y: p.y });
  invalid.cast();
  expect(invalid.w.ahriRushes).toEqual([]);
  expect(invalid.state.cooldowns.r).toBe(0);
});

test('Flash stops the dash independently while its window and already fired bolts remain', () => {
  const { w, ahri, target, cast, restore } = setup();
  target();
  cast();
  const slot = w.summonerSlot('flash', ahri.id)!;
  w.enqueue({ type: 'cast', unit: ahri.id, ability: slot, point: { x: 20, y: 400 } });
  w.step();
  expect(w.ahriRushes[0].bursts[0].stopReason).toBe('flash');
  expect(activeSpiritDash(w, ahri.id)).toBeUndefined();
  expect(activeSpiritRush(w, ahri.id)?.remainingCasts).toBe(2);
  expect(ahri.y).toBe(400);
  restore();
});

test('ability haste affects the initial cooldown while the recast lockout stays one second', () => {
  const { w, ahri, state, cast, restore } = setup();
  state.inventory = ['codex'];
  const haste = w.abilityHaste(ahri.id);
  cast();
  expect(state.cooldowns.r - w.tick).toBe(Math.ceil((140 * 60 * 100) / (100 + haste)));
  expect(w.abilityResources('r', ahri.id)).toEqual({ mana: 0, cooldownSeconds: 1 });
  expect(w.abilityCooldownTicks('r', ahri.id)).toBe(60);
  restore();
});

test('each recast captures its current rank and AP while retaining the initial cooldown', () => {
  const { w, ahri, state, target, cast, restore } = setup();
  const victim = target(400);
  cast();
  w.step(59);
  const cooldown = state.cooldowns.r;
  w.learnSpell('r', ahri.id);
  state.inventory = ['tome'];
  const ap = w.abilityPower(ahri);
  cast({ x: 900, y: 0 });
  expect(w.ahriRushes[0].bursts[1]).toMatchObject({
    rank: 2,
    damage: AHRI_R.damageByRank[1] + AHRI_R.abilityPowerRatio * ap,
  });
  expect(state.cooldowns.r).toBe(cooldown);
  state.inventory = [];
  w.step(30);
  expect(victim.maxHp - victim.hp).toBeCloseTo(75 + 125 + ap * AHRI_R.abilityPowerRatio, 7);
  restore();
});

test('accepted final-window dash can finish after the recast window expires', () => {
  const { w, ahri, cast, restore } = setup();
  cast();
  w.step(898);
  cast({ x: 1000, y: 0 });
  expect(w.tick).toBe(900);
  expect(activeSpiritDash(w, ahri.id)).toBeDefined();
  w.step();
  expect(activeSpiritRush(w, ahri.id)).toBeUndefined();
  expect(activeSpiritDash(w, ahri.id)).toBeDefined();
  restore();
  w.step(23);
  expect(ahri.x).toBe(1000);
  expect(w.ahriRushes).toEqual([]);
  restore();
});

test('bolts keep tracking after vision loss, but target death spends them without retargeting', () => {
  const f = setup(),
    target = f.target(600);
  f.cast();
  f.w.visible = () => false;
  target.y = 300;
  f.w.step(60);
  expect(target.maxHp - target.hp).toBe(75);
  f.restore();
  const lost = setup(),
    t = lost.target(600);
  lost.cast();
  const other = lost.target(100);
  lost.w.damage(lost.w.hero, t, 1e6, 'true');
  lost.w.step();
  expect(lost.w.ahriRushes[0].bursts[0].bolts[0].stopReason).toBe('lost-target');
  expect(other.hp).toBe(other.maxHp);
  lost.restore();
});

test('new casts and recall wait during a dash while movement orders buffer and Heal remains permitted', () => {
  const { w, ahri, state, cast, restore } = setup();
  w.learnSpell('q', ahri.id);
  cast();
  const heal = w.summonerSlot('heal', ahri.id)!;
  ahri.hp = 1000;
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.enqueue({ type: 'order', unit: ahri.id, order: { type: 'move', point: { x: 500, y: 500 } } });
  w.enqueue({ type: 'cast', unit: ahri.id, ability: heal, point: { x: 20, y: 0 } });
  w.step();
  expect(ahri.hp).toBeGreaterThan(1000);
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.q).toBe(0);
  expect(state.recallEnd).toBeNull();
  expect(ahri.order.type).toBe('move');
  restore();
  w.step(30);
  expect(ahri.y).toBeGreaterThan(0);
});

test('edited recast, dash and bolt saves are rejected', () => {
  const { w, target, cast } = setup();
  target();
  cast();
  const raw = JSON.parse(w.snapshot());
  for (const mutate of [
    (r: any) => r.remainingCasts++,
    (r: any) => r.endTick++,
    (r: any) => r.nextCastTick++,
    (r: any) => (r.id = raw.player.id),
    (r: any) => (r.bursts[0].rank = 3),
    (r: any) => (r.bursts[0].damage = 0),
    (r: any) => r.bursts[0].lastTick++,
    (r: any) => r.bursts[0].destination.x++,
    (r: any) => r.bursts[0].origin.y++,
    (r: any) => (r.bursts[0].bolts[0].targetId = r.id),
    (r: any) => (r.bursts[0].bolts[0].position.x += 100),
    (r: any) => (r.bursts[0].bolts[0].index = 1),
    (r: any) => r.bursts[0].bolts.push(structuredClone(r.bursts[0].bolts[0])),
  ]) {
    const bad = structuredClone(raw);
    mutate(bad.ahriRushes[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
});

test('controlled terminal settlement clears Spirit Rush and freezes restored state', () => {
  const { w, target, cast, restore } = setup();
  target();
  cast();
  const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(w.ahriRushes).toEqual([]);
  const saved = w.snapshot(),
    copy = restore();
  w.step(100);
  copy.step(100);
  expect(w.snapshot()).toBe(saved);
  expect(copy.snapshot()).toBe(saved);
});

test('angled dashes round-trip every movement frame and finish on their exact destination tick', () => {
  for (const angle of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, Math.PI / 4]) {
    const { w, ahri, cast, restore } = setup();
    cast({ x: 900 * Math.cos(angle), y: 900 * Math.sin(angle) });
    for (let frame = 1; frame <= 25; frame++) {
      if (frame > 1) w.step();
      restore();
    }
    expect(activeSpiritDash(w, ahri.id)).toBeUndefined();
    expect(Math.hypot(ahri.x, ahri.y)).toBeCloseTo(500, 8);
  }
});

test('acquisition excludes allies, structures, out-of-range enemies and protected monsters', () => {
  const { w, ahri, target, cast, restore } = setup();
  w.spawn('dummy', 'blue', { x: 100, y: 0 });
  w.spawn('turret', 'red', { x: 200, y: 0 });
  const monster = w.spawnMonster(
    { x: 300, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  const outside = target(601);
  const victim = target(590);
  cast({ x: 100, y: 100 });
  expect(w.ahriRushes[0].bursts[0].bolts.map((p) => p.targetId)).toEqual([victim.id]);
  w.step(40);
  expect(monster.hp).toBe(monster.maxHp);
  expect(outside.hp).toBe(outside.maxHp);
  expect(victim.maxHp - victim.hp).toBe(75);
  expect(ahri.hp).toBeGreaterThan(0);
  restore();
});

test('a bolt pursuing a faster target expires on the explicit local pursuit deadline', () => {
  const { w, target, cast, restore } = setup();
  const runner = target(600);
  runner.speed = 1500;
  w.setOrder(runner, { type: 'move', point: { x: 10000, y: 0 } });
  cast();
  w.step(240);
  expect(w.ahriRushes[0].bursts[0].bolts[0]).toMatchObject({
    stopTick: 241,
    stopReason: 'expired',
  });
  expect(runner.hp).toBe(runner.maxHp);
  restore();
});
