import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { requestWard } from '../src/simulation/wards';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  const state = w.championState(leona.id)!;
  const dummy = (x: number, y = 0) => {
    const u = w.spawn('dummy', 'red', { x, y });
    u.magicResist = 0;
    return u;
  };
  const learn = () => {
    w.gainExperience(2400, leona.id);
    expect(w.learnSpell('r', leona.id)).toBeNull();
  };
  const cast = (point = { x: 500, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: leona.id, ability: 'r', point });
    w.step();
  };
  const impact = () => w.step(state.leonaR!.impactTick - w.tick);
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, leona, state, dummy, learn, cast, impact, restore };
}

test('Solar Flare validates rank, mana, cooldown, silence and stun while allowing a rooted caster', () => {
  const f = setup();
  f.cast();
  expect(f.state.leonaR).toBeNull();
  expect(f.w.learnSpell('r', f.leona.id)).not.toBeNull();
  f.learn();
  f.leona.mana = 99;
  f.cast();
  expect(f.state.leonaR).toBeNull();
  f.leona.mana = f.leona.maxMana;
  for (const kind of ['stunUntil', 'silenceUntil'] as const) {
    f.leona[kind] = f.w.tick + 3;
    f.cast();
    expect(f.state.leonaR).toBeNull();
    f.w.step(3);
  }
  f.leona.rootUntil = f.w.tick + 90;
  f.state.inventory.push('chapter');
  const mana = f.leona.mana;
  f.cast();
  expect(Math.round(mana - f.leona.mana)).toBe(100);
  expect(f.state.cooldowns.r).toBe(f.w.tick + Math.ceil(((90 * 100) / 110) * 60));
  const flare = structuredClone(f.state.leonaR);
  f.cast();
  expect(f.state.leonaR).toEqual(flare);
  expect(f.leona.rootUntil).toBeGreaterThan(f.w.tick);
  expect(f.state.pendingCast).toBeNull();
  expect(f.state.castAnimation).toEqual({ ability: 'r', startTick: f.state.leonaR!.startTick });
  expect(f.w.projectiles).toEqual([]);
  expect(() => f.restore()).not.toThrow();
});

test('ground targeting clamps at 1200 from the captured origin and permits a self-centered cast', () => {
  const f = setup();
  f.learn();
  f.cast({ x: 3000, y: 4000 });
  expect(f.state.leonaR).toEqual({
    startTick: 1,
    releaseTick: 16,
    impactTick: 39,
    released: false,
    rank: 1,
    origin: { x: 0, y: 0 },
    point: { x: 720, y: 960 },
    damage: 150,
  });
  expect(() => f.restore()).not.toThrow();
  const self = setup();
  self.learn();
  self.cast(self.leona);
  expect(self.state.leonaR?.point).toEqual({ x: 0, y: 0 });
});

test('windup holds walking, then resumes buffered movement without cancelling the delayed impact', () => {
  const f = setup();
  f.learn();
  const target = f.dummy(500);
  f.cast();
  f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
  f.w.enqueue({ type: 'recall', unit: f.leona.id });
  const copy = f.restore();
  f.w.step(14);
  copy.step(14);
  expect(f.leona.y).toBe(0);
  expect(f.state.leonaR?.released).toBe(false);
  expect(f.state.recallEnd).toBeNull();
  f.w.step();
  copy.step();
  expect(f.state.leonaR?.released).toBe(true);
  expect(f.leona.y).toBeGreaterThan(0);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  const released = f.restore();
  f.impact();
  released.step(f.w.tick - released.tick);
  expect(target.hp).toBe(1350);
  expect(f.state.leonaR).toBeNull();
  expect(released.snapshot()).toBe(f.w.snapshot());
});

test('impact has distinct inclusive center and outer boundaries and applies Sunlight only to survivors', () => {
  const f = setup();
  f.learn();
  const center = f.dummy(500),
    innerEdge = f.dummy(660),
    outerRing = f.dummy(660.001),
    outerEdge = f.dummy(840),
    outside = f.dummy(840.001),
    lethal = f.dummy(500, 100);
  lethal.hp = 1;
  f.cast();
  f.w.step(37);
  expect(center.hp).toBe(1500);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect([center, innerEdge, outerRing, outerEdge, outside].map((u) => u.hp)).toEqual([
    1350, 1350, 1350, 1350, 1500,
  ]);
  expect([center, innerEdge].map((u) => u.stunUntil)).toEqual([144, 144]);
  expect(center.slows).toEqual([]);
  expect(innerEdge.slows).toEqual([]);
  for (const u of [outerRing, outerEdge]) {
    expect(u.stunUntil).toBe(0);
    expect(u.slows).toHaveLength(1);
    expect(u.slows[0]).toMatchObject({
      kind: 'solar-flare',
      sourceId: f.leona.id,
      startTick: 39,
      endTick: 144,
    });
    expect(f.w.slowFactor(u)).toBeCloseTo(0.2, 10);
    expect(u.sunlight).not.toBeNull();
  }
  expect(outside.sunlight).toBeNull();
  expect(lethal.deadAt).toBe(39);
  expect(lethal.sunlight).toBeNull();
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(() => f.restore()).not.toThrow();
});

test('the fixed ground point samples current target positions and resolves before same-tick Flash commands', () => {
  const f = setup();
  f.learn();
  const leave = f.dummy(500),
    enter = f.dummy(1100);
  const enemy = f.w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
  enemy.magicResist = 0;
  f.cast();
  f.w.step(37);
  leave.x = 1100;
  enter.x = 500;
  f.w.enqueue({ type: 'cast', unit: enemy.id, ability: 'd', point: { x: 1200, y: 0 } });
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(leave.hp).toBe(1500);
  expect(enter.hp).toBe(1350);
  expect(enemy.x).toBe(1200);
  expect(enemy.slows[0]?.kind).toBe('solar-flare');
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('simultaneous participant order is stable by identity when the unit array is reversed', () => {
  const f = setup();
  f.learn();
  const targets = [500, 600, 800].map((x) => f.dummy(x));
  f.w.units.reverse();
  f.cast();
  f.impact();
  expect(f.w.events.filter((e) => e.type === 'damage').map((e) => e.unit)).toEqual(
    targets.map((u) => u.id)
  );
});

test('fully shielded hits still control and mark, after ordinary magic resistance', () => {
  const f = setup();
  f.learn();
  const victim = f.w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux');
  victim.magicResist = 100;
  f.w.applyShield(victim, victim, 1000, 500);
  f.cast();
  f.impact();
  expect(victim.hp).toBe(victim.maxHp);
  expect(f.w.shieldAmount(victim)).toBe(925);
  expect(victim.stunUntil).toBe(144);
  expect(victim.sunlight).not.toBeNull();
  expect(() => f.restore()).not.toThrow();
});

test('Courage reduces the new stun and slow durations through the existing application path', () => {
  const f = setup();
  f.learn();
  const targets = [500, 750].map((x) => f.w.spawn('champion', 'red', { x, y: 0 }, 'garen'));
  for (const u of targets) {
    u.magicResist = 0;
    f.w.learnSpell('w', u.id);
    f.w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
  }
  f.cast();
  f.impact();
  expect(targets[0].stunUntil).toBe(81);
  expect(targets[0].slows).toEqual([]);
  expect(targets[1].slows[0]).toMatchObject({ startTick: 39, endTick: 81 });
  expect(targets[1].stunUntil).toBe(0);
  expect(() => f.restore()).not.toThrow();
});

test('damage, rank and AP remain captured while later ranks retain 100-mana resource costs', () => {
  const f = setup();
  f.learn();
  const victim = f.dummy(500);
  f.cast();
  f.w.gainExperience(1e6, f.leona.id);
  f.w.learnSpell('r', f.leona.id);
  f.w.learnSpell('r', f.leona.id);
  f.state.inventory.push('tome');
  expect(f.state.leonaR?.damage).toBe(150);
  f.impact();
  expect(victim.hp).toBe(1350);
  f.state.cooldowns.r = 0;
  expect(f.w.abilityResources('r', f.leona.id).mana).toBe(100);
  f.cast();
  expect(f.state.leonaR?.damage).toBeCloseTo(316, 6);
  expect(f.state.leonaR?.rank).toBe(3);
});

test('later crowd control does not cancel the committed windup or its delayed impact', () => {
  const f = setup();
  f.learn();
  const victim = f.dummy(500);
  f.cast();
  f.w.applyStun(f.leona, 120);
  f.w.applyRoot(f.leona, 120);
  f.w.applySilence(f.leona, 120);
  const copy = f.restore();
  f.impact();
  copy.step(f.w.tick - copy.tick);
  expect(victim.hp).toBe(1350);
  expect(f.leona.x).toBe(0);
  expect(f.leona.y).toBe(0);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('death before release cancels; a released flare retains posthumous damage and crowd control', () => {
  for (const released of [false, true]) {
    const f = setup();
    f.learn();
    const victim = f.dummy(500),
      ring = f.dummy(800);
    f.cast();
    if (released) f.w.step(15);
    f.w.damage(victim, f.leona, 1e6, 'true');
    expect(f.state.leonaR !== null).toBe(released);
    const copy = f.restore();
    f.w.step(39 - f.w.tick);
    copy.step(39 - copy.tick);
    expect(victim.hp).toBe(released ? 1350 : 1500);
    expect(victim.stunUntil).toBe(released ? 144 : 0);
    expect(ring.slows.length).toBe(released ? 1 : 0);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    expect(() => f.restore()).not.toThrow();
  }
});

test('death on the release boundary preserves commitment independently of owner iteration order', () => {
  for (const reversed of [false, true]) {
    const f = setup();
    f.learn();
    const victim = f.dummy(500);
    const enemy = f.w.spawn('champion', 'red', { x: 0, y: 0 }, 'leona');
    f.w.learnSpell('w', enemy.id);
    f.w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    f.w.step(165);
    f.cast();
    expect(f.state.leonaR?.releaseTick).toBe(181);
    f.w.step(14);
    f.leona.hp = 1;
    if (reversed) f.w.units.reverse();
    f.w.step();
    expect(f.leona.deadAt).toBe(181);
    expect(f.state.leonaR?.released).toBe(true);
    const copy = f.restore();
    f.impact();
    copy.step(f.w.tick - copy.tick);
    expect(victim.hp).toBe(1350);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});

test('Flash during windup keeps the captured ground point and adds no separate area vision or projectile', () => {
  const f = setup();
  f.learn();
  const victim = f.dummy(500);
  f.cast();
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 0, y: 400 } });
  f.w.step();
  expect(f.leona.y).toBe(400);
  expect(f.state.leonaR?.point).toEqual({ x: 500, y: 0 });
  expect(f.state.leonaR?.origin).toEqual({ x: 0, y: 0 });
  const copy = f.restore();
  f.impact();
  copy.step(f.w.tick - copy.tick);
  expect(victim.hp).toBe(1350);
  expect(f.w.visionAreas).toEqual([]);
  expect(f.w.projectiles).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('R rejects a concurrent E windup but can run during a released E flight or homing dash', () => {
  for (const phase of ['windup', 'flight', 'dash']) {
    const f = setup();
    f.learn();
    f.w.learnSpell('e', f.leona.id);
    const target = f.w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.magicResist = 0;
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'e', point: target });
    f.w.step();
    if (phase === 'flight') f.w.step(20);
    if (phase === 'dash') f.w.step(41);
    f.cast(target);
    if (phase === 'windup') {
      expect(f.state.leonaR).toBeNull();
      continue;
    }
    const start = f.state.leonaR!.startTick,
      copy = f.restore();
    f.w.step(5);
    copy.step(5);
    if (phase === 'dash') expect(f.leona.x).toBeGreaterThan(0);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    f.w.step(start + 38 - f.w.tick);
    copy.step(f.w.tick - copy.tick);
    expect(target.stunUntil).toBe(f.w.tick + 105);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});

test('Q/W can arm during R windup, while E and recall wait for its release', () => {
  const f = setup();
  f.learn();
  for (const key of ['q', 'w', 'e'] as const) f.w.learnSpell(key, f.leona.id);
  f.cast();
  const captured = structuredClone(f.state.leonaR);
  for (const ability of ['q', 'w', 'e'] as const)
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability, point: { x: 500, y: 0 } });
  f.w.enqueue({ type: 'recall', unit: f.leona.id });
  f.w.step();
  expect(f.state.leonaQ).not.toBeNull();
  expect(f.state.leonaW).not.toBeNull();
  expect(f.state.leonaEWindup).toBeNull();
  expect(f.state.recallEnd).toBeNull();
  expect(f.state.leonaR).toEqual(captured);
  expect(() => f.restore()).not.toThrow();
});

test('unseen enemies and neutrals can be hit; allies, structures, wards and returning camps are excluded', () => {
  const f = setup();
  f.learn();
  const ally = f.w.spawn('dummy', 'blue', { x: 500, y: 0 }),
    tower = f.w.spawn('turret', 'red', { x: 500, y: 0 });
  tower.ai = false;
  const enemy = f.w.spawn('champion', 'red', { x: 500, y: 400 }, 'lux');
  requestWard(f.w, enemy, { x: 500, y: 0 });
  f.w.step(20);
  enemy.x = 2000;
  const ward = f.w.units.find((u) => u.kind === 'ward')!,
    target = f.dummy(500);
  const returning = f.w.spawnMonster({ x: 500, y: 0 });
  returning.monster.phase = 'returning';
  returning.monster.home.x = 3000;
  returning.speed = 0;
  const monster = f.w.spawnMonster({ x: 600, y: 0 });
  monster.magicResist = 0;
  f.w.battlefield.lineOfSight = () => false;
  const hp = [ally, tower, ward, returning].map((u) => u.hp);
  f.cast();
  expect(f.w.visible(target, 'blue')).toBe(false);
  f.impact();
  expect(target.hp).toBe(1350);
  expect(monster.hp).toBeLessThan(monster.maxHp);
  expect(monster.monster.targetId).toBeNull();
  expect(monster.monster.phase).toBe('returning');
  expect(monster.sunlight).toBeNull();
  expect([ally, tower, ward, returning].map((u) => u.hp)).toEqual(hp);
});

test('victory clears either R phase and an empty impact changes no RNG, attack range or old on-hit state', () => {
  const empty = setup();
  empty.learn();
  const range = empty.w.attackRange(empty.leona),
    damage = empty.leona.damage,
    random = empty.w.random.state;
  empty.cast();
  const id = empty.w.nextId;
  empty.impact();
  expect(empty.w.nextId).toBe(id);
  expect(empty.w.random.state).toBe(random);
  expect(empty.leona.damage).toBe(damage);
  expect(empty.w.attackRange(empty.leona)).toBe(range);
  expect(empty.state.leonaQ).toBeNull();
  for (const released of [false, true]) {
    const f = setup();
    f.learn();
    f.cast();
    if (released) f.w.step(15);
    const nexus = f.w.spawn('nexus', 'red', { x: 2000, y: 0 });
    f.w.damage(f.leona, nexus, 1e6, 'true');
    expect(f.state.leonaR).toBeNull();
    const saved = f.w.snapshot();
    f.w.step(100);
    expect(f.w.snapshot()).toBe(saved);
    expect(() => f.restore()).not.toThrow();
  }
});

test('strict snapshots reject foreign R, malformed phases/geometry and foreign or altered solar slows', () => {
  const f = setup();
  f.learn();
  const victim = f.dummy(800);
  f.cast();
  const forge = (change: (s: any, o: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.leona.id);
    change(s, o);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  for (const key of ['releaseTick', 'impactTick', 'startTick']) forge((_s, o) => o.leonaR[key]++);
  forge((_s, o) => (o.leonaR.released = true));
  forge((_s, o) => (o.leonaR.point.x = 1201));
  forge((s, o) => {
    s.player.leonaR = o.leonaR;
    o.leonaR = null;
  });
  f.w.step(15);
  forge((_s, o) => (o.leonaR.released = false));
  f.impact();
  const slow = (s: any) => s.units.find((u: any) => u.id === victim.id).slows[0];
  forge((s) => (slow(s).startMultiplier = 0.5));
  forge((s) => (slow(s).endMultiplier = 1));
  forge((s) => (slow(s).endTick += 200));
  forge((s) => (slow(s).sourceId = f.w.hero.id));
  forge((_s, o) => (o.spellRanks.r = 0));
  expect(f.w.applySlow(f.w.hero, victim, 'solar-flare', 105, 0.2)).toBe(false);
  expect(() => f.restore()).not.toThrow();
});

test('a visible neutral hit retains retaliation, control and Sunlight through restored futures', () => {
  const f = setup();
  f.learn();
  const monster = f.w.spawnMonster({ x: 600, y: 0 });
  monster.magicResist = 0;
  f.cast();
  f.w.step(37);
  const before = f.restore();
  f.w.step();
  before.step();
  expect(monster.monster.targetId).toBe(f.leona.id);
  expect(monster.monster.phase).toBe('engaged');
  expect(monster.stunUntil).toBe(144);
  expect(monster.sunlight?.sourceId).toBe(f.leona.id);
  expect(before.snapshot()).toBe(f.w.snapshot());
  const after = f.restore();
  f.w.step(120);
  before.step(120);
  after.step(120);
  expect(before.snapshot()).toBe(f.w.snapshot());
  expect(after.snapshot()).toBe(f.w.snapshot());
});

test('independent Solar Flare slows retain each caster and retire on their separate deadlines', () => {
  const f = setup();
  f.learn();
  const victim = f.dummy(800);
  f.cast();
  const other = f.w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  f.w.gainExperience(2400, other.id);
  f.w.learnSpell('r', other.id);
  f.w.enqueue({ type: 'cast', unit: other.id, ability: 'r', point: { x: 500, y: 0 } });
  f.w.step(39);
  expect(victim.slows.map((s) => s.sourceId)).toEqual([f.leona.id, other.id]);
  expect(victim.slows.map((s) => s.endTick)).toEqual([144, 145]);
  expect(f.w.slowFactor(victim)).toBeCloseTo(0.2, 10);
  f.w.step(103);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(victim.slows).toHaveLength(1);
  expect(victim.slows[0].sourceId).toBe(other.id);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  const second = f.restore();
  f.w.step();
  copy.step();
  second.step();
  expect(victim.slows).toEqual([]);
  expect(f.w.slowFactor(victim)).toBe(1);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(second.snapshot()).toBe(f.w.snapshot());
});

test('R cancels an ordinary pending attack but cannot replace a committed Daybreak', () => {
  for (const empowered of [false, true]) {
    const f = setup();
    f.learn();
    f.w.learnSpell('q', f.leona.id);
    const victim = f.dummy(100);
    if (empowered) f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: victim });
    f.w.setOrder(f.leona, { type: 'attack', target: victim.id });
    f.w.step();
    const release = f.leona.releaseTick!,
      mana = f.leona.mana;
    f.cast();
    if (empowered) {
      expect(f.state.leonaR).toBeNull();
      expect(f.leona.releaseTick).toBe(release);
      expect(f.leona.mana).toBeGreaterThanOrEqual(mana);
      expect(f.state.cooldowns.r).toBe(0);
    } else {
      expect(f.state.leonaR).not.toBeNull();
      expect(f.leona.releaseTick).toBeNull();
      expect(f.leona.attackCycle).toBeNull();
      expect(f.leona.nextAttackTick).toBe(f.w.tick);
    }
    expect(() => f.restore()).not.toThrow();
  }
});
