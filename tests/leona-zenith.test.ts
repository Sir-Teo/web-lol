import { expect, test } from 'vitest';
import { NavGrid, fromRiot, type NavGridMetadata } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_COMBAT_POLICY as P } from '../src/content/leona-combat-policy';
import { requestWard } from '../src/simulation/wards';
import { leonaZenithValues } from '../src/simulation/leona-spell-values';

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
  const enemy = (x: number, y = 0) => {
    const u = w.spawn('champion', 'red', { x, y }, 'lux');
    u.magicResist = 0;
    return u;
  };
  const cast = (point = { x: 900, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: leona.id, ability: 'e', point });
    w.step();
  };
  const learn = () => expect(w.learnSpell('e', leona.id)).toBeNull();
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  const finishFlight = () => {
    const start =
      state.leonaEWindup?.startTick ??
      w.projectiles.find((p) => p.type === 'zenith')!.zenith!.castTick;
    w.step(start + 41 - w.tick);
  };
  return { w, leona, state, enemy, cast, learn, restore, finishFlight };
}

test('Zenith validates resources, silence, stun, root and direction without entering Hawkshot state', () => {
  const f = setup();
  f.cast();
  expect(f.state.leonaEWindup).toBeNull();
  f.learn();
  f.cast({ x: 0, y: 0 });
  expect(f.state.cooldowns.e).toBe(0);
  f.leona.mana = 39;
  f.cast();
  expect(f.state.leonaEWindup).toBeNull();
  f.leona.mana = 302;
  for (const key of ['stunUntil', 'rootUntil', 'silenceUntil'] as const) {
    f.leona[key] = f.w.tick + 3;
    f.cast();
    expect(f.state.leonaEWindup).toBeNull();
    f.w.step(3);
  }
  f.state.inventory.push('chapter');
  const mana = f.leona.mana;
  f.cast();
  expect(f.leona.mana).toBeCloseTo(mana - 40 + 0.02, 6);
  expect(f.state.cooldowns.e).toBe(f.w.tick + Math.ceil(((12 * 100) / 110) * 60));
  expect(f.state.leonaEWindup).toMatchObject({
    rank: 1,
    releaseTick: f.w.tick + 15,
    direction: { x: 1, y: 0 },
  });
  expect(f.state.pendingCast).toBeNull();
  expect(f.state.castAnimation).toEqual({
    ability: 'e',
    startTick: f.state.leonaEWindup!.startTick,
  });
  expect(f.state.eCharges).toBe(0);
  expect(f.state.eRechargeTick).toBeNull();
  expect(f.w.projectiles).toEqual([]);
  expect(() => f.restore()).not.toThrow();
});

test('committed windup holds movement, survives later control and releases the source missile exactly once', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
  f.w.applyStun(f.leona, 90);
  const copy = f.restore();
  f.w.step(14);
  copy.step(14);
  expect(f.leona.x).toBe(0);
  expect(f.leona.y).toBe(0);
  expect(f.w.projectiles).toEqual([]);
  f.w.step();
  copy.step();
  const p = f.w.projectiles[0];
  expect(p.type).toBe('zenith');
  expect(p.speed).toBe(2000);
  expect(p.radius).toBe(70);
  expect(p.x).toBeCloseTo(2000 / 60, 8);
  expect(p.remaining).toBeCloseTo(900 - 2000 / 60, 8);
  expect(p.zenith).toEqual({ castTick: 1, rank: 1, hits: [], lastChampionId: null });
  expect(f.state.leonaEWindup).toBeNull();
  expect(f.w.snapshot()).toBe(copy.snapshot());
  expect(() => f.restore()).not.toThrow();
});

test('swept flight damages each eligible target once, then roots and dashes to the last champion', () => {
  const f = setup();
  const targets = [200, 500, 800].map((x) => f.enemy(x));
  const minion = f.w.spawn('melee', 'red', { x: 350, y: 0 });
  minion.speed = 0;
  minion.magicResist = 0;
  f.learn();
  f.cast();
  f.w.step(23);
  expect(f.w.projectiles[0].zenith!.hits).toContain(targets[0].id);
  const copy = f.restore();
  f.finishFlight();
  copy.step(f.w.tick - copy.tick);
  expect(f.w.projectiles).toEqual([]);
  expect(targets.map((u) => u.rootUntil)).toEqual([0, 0, 72]);
  expect(f.state.leonaDash).toEqual({ castTick: 1, startTick: 42, targetId: targets[2].id });
  for (const unit of [...targets, minion]) {
    expect(
      f.w.events.filter((e) => e.type === 'damage' && e.unit === unit.id).map((e) => e.value)
    ).toEqual([50]);
    expect(unit.sunlight?.sourceId).toBe(f.leona.id);
  }
  expect(copy.snapshot()).toBe(f.w.snapshot());
  const dashCopy = f.restore();
  f.w.step(10);
  dashCopy.step(10);
  expect(f.leona.x).toBeCloseTo((P.zenithDashSpeed * 10) / 60, 8);
  expect(dashCopy.snapshot()).toBe(f.w.snapshot());
  const middle = f.restore();
  f.w.step(12);
  middle.step(12);
  expect(f.state.leonaDash).toBeNull();
  expect(f.leona.x).toBeCloseTo(730, 8);
  expect(f.leona.order).toEqual({ type: 'attack', target: targets[2].id });
  expect(middle.snapshot()).toBe(f.w.snapshot());
});

test('sweep order is independent of unit-array order and equal contacts break ties by identity', () => {
  const f = setup();
  const first = f.enemy(300),
    second = f.enemy(300),
    last = f.enemy(800);
  f.w.units.reverse();
  f.learn();
  f.cast();
  f.w.step(20);
  expect(f.w.projectiles[0].zenith!.hits).toEqual([first.id, second.id]);
  f.finishFlight();
  expect(f.state.leonaDash!.targetId).toBe(last.id);
});

test('line geometry covers initial overlap, tangency and the full projected range', () => {
  const f = setup();
  const overlap = f.w.spawn('dummy', 'red', { x: 0, y: 0 });
  const tangent = f.w.spawn('dummy', 'red', { x: 600, y: 70 + overlap.radius });
  const outside = f.w.spawn('dummy', 'red', { x: 600, y: tangent.y + 0.001 });
  const edge = f.w.spawn('dummy', 'red', { x: 900 + 70 + overlap.radius, y: 0 });
  for (const u of [overlap, tangent, outside, edge]) u.magicResist = 0;
  f.learn();
  f.cast({ x: 10, y: 0 });
  f.finishFlight();
  expect([overlap, tangent, outside, edge].map((u) => u.hp)).toEqual([1450, 1450, 1500, 1450]);
  expect(f.state.leonaDash).toBeNull();
  expect(() => f.restore()).not.toThrow();
});

test('flight ignores allies, structures, wards and recovery while hitting unseen enemies', () => {
  const f = setup();
  const enemy = f.enemy(100, 300);
  expect(requestWard(f.w, enemy, { x: 100, y: 0 })).toBeNull();
  f.w.step(20);
  enemy.x = 1200;
  const ward = f.w.units.find((u) => u.kind === 'ward')!;
  const tower = f.w.spawn('turret', 'red', { x: 100, y: 0 });
  tower.ai = false;
  const ally = f.w.spawn('dummy', 'blue', { x: 200, y: 0 });
  const target = f.w.spawn('dummy', 'red', { x: 400, y: 0 });
  target.magicResist = 0;
  const monster = f.w.spawnMonster({ x: 500, y: 0 });
  monster.monster.phase = 'returning';
  monster.monster.home.x = 3000;
  monster.speed = 0;
  f.w.battlefield.lineOfSight = () => false;
  f.learn();
  f.cast();
  expect(f.w.visible(target, 'blue')).toBe(false);
  const hp = [ward, tower, ally, monster].map((u) => u.hp);
  f.finishFlight();
  expect([ward, tower, ally, monster].map((u) => u.hp)).toEqual(hp);
  expect(target.hp).toBe(1450);
  expect(f.state.leonaDash).toBeNull();
});

test('damage and rank are captured at cast; a fully shielded last champion still receives the root and dash', () => {
  const f = setup();
  const target = f.enemy(600);
  f.w.applyShield(target, target, 1000, 500);
  f.learn();
  f.cast();
  f.w.gainExperience(10000, f.leona.id);
  f.w.learnSpell('e', f.leona.id);
  f.state.inventory.push('tome');
  f.finishFlight();
  expect(f.w.shieldAmount(target)).toBe(950);
  expect(target.hp).toBe(target.maxHp);
  expect(f.state.leonaDash?.targetId).toBe(target.id);
  expect(target.rootUntil).toBe(f.w.tick + 30);
  expect(leonaZenithValues(2, f.w.abilityPower(f.leona)).magicDamage).toBeGreaterThan(50);
  expect(() => f.restore()).not.toThrow();
});

test('a dead final champion cancels pursuit without falling back to an earlier survivor', () => {
  const f = setup();
  const first = f.enemy(200),
    last = f.enemy(800);
  last.hp = 1;
  f.learn();
  f.cast();
  f.finishFlight();
  expect(last.deadAt).not.toBeNull();
  expect(first.rootUntil).toBe(0);
  expect(f.state.leonaDash).toBeNull();
  expect(f.leona.x).toBe(0);
  expect(() => f.restore()).not.toThrow();
});

test('death cancels a windup but a launched flight retains damage and root without a posthumous dash', () => {
  for (const launched of [false, true]) {
    const f = setup();
    const target = f.enemy(800);
    f.learn();
    f.cast();
    if (launched) f.w.step(15);
    f.w.damage(target, f.leona, 1e6, 'true');
    expect(f.state.leonaEWindup).toBeNull();
    const copy = f.restore();
    f.w.step(42 - f.w.tick);
    copy.step(42 - copy.tick);
    expect(target.hp < target.maxHp).toBe(launched);
    expect(target.rootUntil).toBe(launched ? 72 : 0);
    expect(f.state.leonaDash).toBeNull();
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});

test('Flash during windup changes launch origin but preserves the captured direction', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 0, y: 400 } });
  f.w.step();
  const copy = f.restore();
  f.w.step(14);
  copy.step(14);
  expect(f.w.projectiles[0]).toMatchObject({ origin: { x: 0, y: 400 }, direction: { x: 1, y: 0 } });
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('dash tracks a moved target, buffers orders and stops on root, stun, death or Flash', () => {
  for (const cause of ['order', 'root', 'stun', 'death', 'flash'] as const) {
    const f = setup();
    const target = f.enemy(800);
    f.learn();
    f.cast();
    f.finishFlight();
    f.w.step(3);
    expect(f.state.leonaDash).not.toBeNull();
    target.y = 150;
    f.w.step(); // Finalize the scripted target move before taking a checkpoint.
    if (cause === 'order') f.w.setOrder(f.leona, { type: 'move', point: { x: -500, y: 0 } });
    if (cause === 'root') f.w.applyRoot(f.leona, 60);
    if (cause === 'stun') f.w.applyStun(f.leona, 60);
    if (cause === 'death') f.w.damage(f.leona, target, 1e6, 'true');
    if (cause === 'flash') {
      f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 100, y: -400 } });
      f.w.step();
    }
    const copy = f.restore();
    if (cause !== 'order') expect(f.state.leonaDash).toBeNull();
    f.w.step(20);
    copy.step(20);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    if (cause === 'order') {
      expect(f.state.leonaDash).toBeNull();
      expect(f.leona.order.type).toBe('move');
      expect(f.leona.y).toBeGreaterThan(0);
    }
  }
});

test('dash traverses a wall without using walking routes and preserves turret retaliation', () => {
  const f = setup();
  f.enemy(600);
  f.w.battlefield.lineWalkable = (a, b) => !(Math.min(a.x, b.x) < 300 && Math.max(a.x, b.x) > 250);
  f.w.battlefield.findPath = () => {
    throw Error('Dash must not use walking pathfinding');
  };
  const tower = f.w.spawn('turret', 'red', { x: 500, y: 200 });
  tower.ai = false;
  tower.range = 1500;
  f.learn();
  f.cast();
  f.finishFlight();
  expect(tower.order).toEqual({ type: 'attack', target: f.leona.id });
  const copy = f.restore();
  f.w.step(16);
  copy.step(16);
  expect(f.leona.x).toBeCloseTo(530, 8);
  expect(f.state.leonaDash).toBeNull();
  expect(tower.order).toEqual({ type: 'attack', target: f.leona.id });
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('a miss and terminal cancellation leave no flight, windup or dash state', () => {
  const miss = setup();
  miss.learn();
  const random = miss.w.random.state;
  miss.cast();
  miss.finishFlight();
  expect(miss.state.leonaDash).toBeNull();
  expect(miss.w.projectiles).toEqual([]);
  expect(miss.w.random.state).toBe(random);
  for (const phase of ['windup', 'flight', 'dash']) {
    const f = setup();
    f.enemy(800);
    f.learn();
    f.cast();
    if (phase === 'flight') f.w.step(15);
    if (phase === 'dash') f.finishFlight();
    const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    f.w.damage(f.leona, nexus, 1e6, 'true');
    expect(f.state.leonaEWindup).toBeNull();
    expect(f.state.leonaDash).toBeNull();
    expect(f.w.projectiles).toEqual([]);
    const saved = f.w.snapshot();
    f.w.step(100);
    expect(f.w.snapshot()).toBe(saved);
    expect(() => f.restore()).not.toThrow();
  }
});

test('strict snapshots reject forged windup, flight participants/geometry and dash clocks', () => {
  const f = setup();
  const first = f.enemy(100),
    target = f.enemy(800);
  f.learn();
  f.cast();
  const forge = (change: (s: any, o: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.leona.id);
    change(s, o);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((_s, o) => o.leonaEWindup.releaseTick++);
  forge((_s, o) => (o.leonaEWindup.direction.x = 2));
  forge((s, o) => {
    s.player.leonaEWindup = o.leonaEWindup;
    o.leonaEWindup = null;
  });
  f.w.step(20);
  for (const key of ['x', 'remaining', 'speed', 'radius', 'launchTick'])
    forge((s) => s.projectiles[0][key]++);
  forge((s) => s.projectiles[0].previous.y++);
  forge((s) => (s.projectiles[0].zenith.hits = [f.leona.id]));
  forge((s) => (s.projectiles[0].zenith.lastChampionId = target.id));
  forge((s) => (s.projectiles[0].zenith.lastChampionId = null));
  forge((s) => (s.projectiles[0].zenith.hits = [first.id, first.id]));
  forge((s) => {
    s.projectiles[0].zenith.hits = [s.projectiles[0].id];
    s.projectiles[0].zenith.lastChampionId = null;
  });
  f.finishFlight();
  forge((_s, o) => o.leonaDash.startTick++);
  forge((_s, o) => (o.leonaDash.targetId = f.leona.id));
  forge((_s, o) => (o.spellRanks.e = 0));
  expect(() => f.restore()).not.toThrow();
});

test('Q and W can arm during E windup without cancelling its locked direction or allowing recall', () => {
  const f = setup();
  f.learn();
  f.w.gainExperience(660, f.leona.id);
  f.w.learnSpell('q', f.leona.id);
  f.w.learnSpell('w', f.leona.id);
  f.cast();
  const cast = structuredClone(f.state.leonaEWindup);
  for (const ability of ['q', 'w'] as const)
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability, point: f.leona });
  f.w.enqueue({ type: 'recall', unit: f.leona.id });
  f.w.step();
  expect(f.state.leonaEWindup).toEqual(cast);
  expect(f.state.leonaQ).not.toBeNull();
  expect(f.state.leonaW).not.toBeNull();
  expect(f.state.recallEnd).toBeNull();
  const copy = f.restore();
  f.w.step(14);
  copy.step(14);
  expect(f.w.projectiles[0].type).toBe('zenith');
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('a captured Daybreak survives E dash startup and releases without adding ordinary walking', () => {
  const f = setup();
  f.learn();
  f.w.gainExperience(280, f.leona.id);
  f.w.learnSpell('q', f.leona.id);
  const close = f.enemy(100),
    last = f.enemy(800);
  f.cast();
  f.w.step(36);
  f.w.setOrder(f.leona, { type: 'attack', target: close.id });
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: close });
  f.w.step();
  const release = f.leona.releaseTick!;
  expect(release).toBe(53);
  f.finishFlight();
  expect(f.leona.releaseTick).toBe(release);
  expect(f.state.leonaDash?.targetId).toBe(last.id);
  const copy = f.restore();
  f.w.step(release - f.w.tick);
  copy.step(release - copy.tick);
  expect(close.stunUntil).toBe(release + 60);
  expect(f.state.leonaQ).toBeNull();
  expect(f.leona.x).toBeCloseTo((11 * 2000) / 60, 8);
  expect(f.w.snapshot()).toBe(copy.snapshot());
  expect(() => f.restore()).not.toThrow();
});

test('a rooted caster still delivers the last-champion root but cannot begin the dash', () => {
  const f = setup();
  const target = f.enemy(800);
  f.learn();
  f.cast();
  f.w.applyRoot(f.leona, 100);
  const copy = f.restore();
  f.finishFlight();
  copy.step(f.w.tick - copy.tick);
  expect(target.rootUntil).toBe(72);
  expect(f.state.leonaDash).toBeNull();
  expect(f.leona.x).toBe(0);
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('interrupting a dash inside terrain resolves a reachable stopping point and preserves its order', () => {
  const f = setup();
  f.enemy(800);
  f.learn();
  f.cast();
  f.finishFlight();
  f.w.step(8);
  expect(f.leona.x).toBeCloseTo(800 / 3, 8);
  const args: unknown[] = [];
  f.w.battlefield.reachable = (p, radius, team) => {
    args.push(radius, team);
    return { x: Math.min(240, p.x), y: p.y };
  };
  const order = structuredClone(f.leona.order);
  f.w.applyRoot(f.leona, 60);
  expect(f.leona.x).toBe(240);
  expect(f.state.leonaDash).toBeNull();
  expect(args).toEqual([35, 'blue']);
  expect(f.leona.order).toEqual(order);
  expect(() => f.restore()).not.toThrow();
});

test('NavGrid wall traversal and an interrupted in-wall dash both end on walkable saved ground', () => {
  const width = 20,
    height = 8,
    count = width * height;
  const buffer = new ArrayBuffer(count * 2 + (width + 1) * (height + 1) * 4);
  const view = new DataView(buffer);
  for (let y = 0; y < height; y++) view.setUint16((y * width + 8) * 2, 2, true);
  const metadata: NavGridMetadata = {
    width,
    height,
    cellSize: 50,
    minimum: [0, 0, 0],
    heightWidth: width + 1,
    heightHeight: height + 1,
    heightSpacing: [50, 50],
    sections: { flags: [0], heights: [count * 2] },
  };
  const grid = new NavGrid(metadata, buffer);
  for (const interrupted of [false, true]) {
    const f = setup();
    Object.assign(f.leona, fromRiot(100, 200));
    const target = f.enemy(0);
    Object.assign(target, fromRiot(700, 200));
    Object.assign(f.w.battlefield, {
      reachable: grid.reachable.bind(grid),
      findPath: grid.findPath.bind(grid),
      lineWalkable: grid.lineWalkable.bind(grid),
      lineOfSight: grid.lineOfSight.bind(grid),
    });
    expect(grid.lineWalkable(f.leona, target, 35)).toBe(false);
    f.learn();
    f.cast(target);
    f.finishFlight();
    f.w.step(interrupted ? 10 : 16);
    if (interrupted) {
      expect(grid.walkable(f.leona, 35)).toBe(false);
      f.w.applyStun(f.leona, 60);
    }
    expect(f.state.leonaDash).toBeNull();
    expect(grid.walkable(f.leona, 35)).toBe(true);
    const copy = f.restore();
    f.w.step(60);
    copy.step(60);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});
