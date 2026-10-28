import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_R } from '../src/content/ahri-r';
import { AHRI_W } from '../src/content/ahri-w';
import { distance } from '../src/simulation/math';
import { World } from '../src/simulation/world';

function setup(team: 'blue' | 'red' = 'blue', level = 6) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    inBrush: () => false,
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 400, y: 0 });
  enemy.ai = false;
  enemy.hp = enemy.maxHp = 10000;
  const state = w.championState(bot.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  state.cooldowns.e = Infinity;
  if (level > 1) w.gainExperience(level === 3 ? 660 : 2400, bot.id);
  bot.ai = true;
  bot.nextThink = 0;
  const planned = () => w.commands.filter((c) => c.type === 'cast' && c.unit === bot.id);
  return { w, bot, enemy, state, planned };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} Ahri uses learned Fox-Fire at close range and restores real hits exactly`, () => {
    const { w, bot, enemy, state, planned } = setup(team, 3);
    w.step();
    expect(state.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 0 });
    expect(planned()).toEqual([
      { type: 'cast', unit: bot.id, ability: 'w', point: { x: bot.x, y: bot.y } },
    ]);
    w.step();
    expect(state.pendingCast?.ability).toBe('w');
    expect(w.movementSpeed(bot)).toBeGreaterThan(bot.speed);
    expect(w.ahriFoxFires[0].fires).toHaveLength(3);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    const hits = new Set<number>();
    for (let i = 0; i < 100; i++) {
      w.step();
      copy.step();
      for (const cast of w.ahriFoxFires)
        for (const fire of cast.fires)
          if (fire.stopReason === 'hit' && fire.targetId === enemy.id) hits.add(fire.index);
    }
    expect(hits.size).toBe(3);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(copy.snapshot()).toBe(w.snapshot());
  });

  test(`${team} retreat chooses a safe Spirit Rush, spends own mana and preserves saved recasts`, () => {
    const { w, bot, enemy, state, planned } = setup(team);
    bot.hp = bot.maxHp * 0.2;
    const origin = { x: bot.x, y: bot.y };
    w.step();
    expect(planned()).toMatchObject([{ ability: 'r', unit: bot.id }]);
    expect(bot.order.type).toBe('idle');
    const mana = bot.mana;
    w.step();
    expect(mana - bot.mana).toBeCloseTo(AHRI_R.manaByRank[0], 0);
    const rush = w.ahriRushes[0];
    expect(rush.remainingCasts).toBe(2);
    expect(distance(origin, rush.bursts[0].destination)).toBeLessThanOrEqual(500 + 1e-8);
    expect(distance(enemy, rush.bursts[0].destination)).toBeGreaterThan(distance(origin, enemy));
    expect(state.cooldowns.r).toBeGreaterThan(w.tick);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(100);
    copy.step(100);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(distance(bot, enemy)).toBeGreaterThan(distance(origin, enemy));
  });
}

test('Charm retains first priority and distant poke retains Q without wasting W or R', () => {
  for (const charm of [false, true]) {
    const { w, enemy, state, planned } = setup();
    if (charm) state.cooldowns.e = 0;
    else enemy.x = 800;
    w.step();
    expect(planned()).toMatchObject([{ ability: charm ? 'e' : 'q' }]);
  }
});

test('Fox-Fire respects its conservative center range and affordable fallback', () => {
  for (const [range, mana, ability] of [
    [AHRI_W.acquisitionRange, 30, 'w'],
    [AHRI_W.acquisitionRange + 0.01, 100, 'q'],
    [400, 29, null],
  ] as const) {
    const { w, bot, enemy, planned } = setup();
    enemy.x = range;
    bot.mana = mana;
    w.step();
    expect(planned().map((c) => c.type === 'cast' && c.ability)).toEqual(ability ? [ability] : []);
  }
});

test('retreat falls back to W speed while keeping a homeward order when R is unavailable', () => {
  const { w, bot, state, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  state.cooldowns.r = Infinity;
  w.step();
  expect(planned()).toMatchObject([{ ability: 'w' }]);
  expect(bot.order).toEqual({ type: 'move', point: w.battlefield.spawns.blue });
  w.step(17);
  expect(w.movementSpeed(bot)).toBeGreaterThan(bot.speed);
  expect(distance(bot, w.battlefield.spawns.blue)).toBeLessThan(
    distance({ x: 0, y: 0 }, w.battlefield.spawns.blue)
  );
});

test('hidden threats cannot trigger W or an escape or alter the visible-threat escape aim', () => {
  const aims: unknown[] = [];
  for (const x of [-200, 200, 3000]) {
    const { w, bot, enemy, planned } = setup();
    bot.hp = bot.maxHp * 0.2;
    const hidden = w.spawn('champion', 'red', { x, y: 100 });
    hidden.ai = false;
    w.battlefield.lineOfSight = (_a, b) => b.y !== 100;
    w.step();
    aims.push(planned());
    expect(w.visible(hidden, 'blue')).toBe(false);
    expect(w.visible(enemy, 'blue')).toBe(true);
  }
  expect(aims[1]).toEqual(aims[0]);
  expect(aims[2]).toEqual(aims[0]);
  const { w, bot, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(planned()).toEqual([]);
});

test('escape rejects obstructed landings and observed tower danger', () => {
  for (const blocked of ['terrain', 'tower'] as const) {
    const { w, bot, state, planned } = setup();
    bot.hp = bot.maxHp * 0.2;
    state.cooldowns.w = Infinity;
    if (blocked === 'terrain') w.battlefield.reachable = () => ({ x: bot.x, y: bot.y });
    else {
      const tower = w.spawn('turret', 'red', { x: -400, y: 0 });
      tower.range = 2000;
      tower.ai = false;
    }
    w.step();
    expect(planned()).toEqual([]);
  }
});

test('escape accounts for every observed nearby threat rather than dashing into a second enemy', () => {
  const { w, bot, enemy, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  const second = w.spawn('champion', 'red', { x: -400, y: 0 });
  second.ai = false;
  w.step();
  expect(planned()).toMatchObject([{ ability: 'r' }]);
  w.step();
  const landing = w.ahriRushes[0].bursts[0].destination;
  expect(distance(landing, enemy)).toBeGreaterThan(550);
  expect(distance(landing, second)).toBeGreaterThan(550);
});

test('root blocks escape while silence, stun, mana and unlearned ranks block both additions', () => {
  for (const condition of ['root', 'silence', 'stun', 'mana', 'unlearned'] as const) {
    const { w, bot, state, planned } = setup('blue', condition === 'unlearned' ? 1 : 6);
    bot.hp = bot.maxHp * 0.2;
    state.cooldowns.w = Infinity;
    if (condition === 'root') bot.rootUntil = 100;
    if (condition === 'silence') bot.silenceUntil = 100;
    if (condition === 'stun') bot.stunUntil = 100;
    if (condition === 'mana') bot.mana = 0;
    w.step();
    expect(planned()).toEqual([]);
  }
});

test('a stun after planning is revalidated without spending escape charges or mana', () => {
  const { w, bot, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  w.step();
  expect(planned()).toMatchObject([{ ability: 'r' }]);
  bot.stunUntil = w.tick + 100;
  const mana = bot.mana;
  w.step();
  expect(w.ahriRushes).toEqual([]);
  expect(bot.mana).toBeGreaterThanOrEqual(mana);
});

test('stored escape casts wait through lockout, cost no mana and stop at exhaustion', () => {
  const { w, bot, enemy, state, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  state.cooldowns.w = Infinity;
  w.step(2);
  const rush = w.ahriRushes[0];
  const cooldown = state.cooldowns.r;
  bot.ai = false;
  w.step(26);
  w.setOrder(bot, { type: 'idle' });
  enemy.x = bot.x + 400;
  enemy.y = bot.y;
  bot.mana = 0;
  bot.ai = true;
  bot.nextThink = 0;
  w.step();
  expect(planned()).toEqual([]);
  expect(rush.remainingCasts).toBe(2);
  for (let remaining = 1; remaining >= 0; remaining--) {
    bot.ai = false;
    w.setOrder(bot, { type: 'idle' });
    w.step(rush.nextCastTick - w.tick);
    // Continue the observed pursuit without borrowing a hidden target position.
    bot.x = bot.y = 0;
    enemy.x = 400;
    enemy.y = 0;
    bot.mana = 0;
    bot.ai = true;
    bot.nextThink = 0;
    w.step();
    expect(planned()).toMatchObject([{ ability: 'r' }]);
    w.step();
    expect(rush.remainingCasts).toBe(remaining);
    expect(bot.mana).toBeLessThan(1);
    expect(state.cooldowns.r).toBe(cooldown);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    bot.ai = false;
    copy.unit(bot.id)!.ai = false;
    w.step(26);
    copy.step(26);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
  w.setOrder(bot, { type: 'idle' });
  bot.x = bot.y = 0;
  enemy.x = 400;
  enemy.y = 0;
  bot.ai = true;
  bot.nextThink = 0;
  w.step();
  expect(planned()).toEqual([]);
  expect(rush.bursts).toHaveLength(3);
});

test('escape holds its evaluated origin and keeps a copied aim after the threat disappears', () => {
  const { w, bot, enemy, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  w.setOrder(bot, { type: 'move', point: { x: 2000, y: 1000 } });
  w.step();
  expect(bot.x).toBe(0);
  expect(bot.y).toBe(0);
  const aim = structuredClone(planned()[0]);
  enemy.x = 2000;
  enemy.y = 2000;
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(aim).toMatchObject({ ability: 'r' });
  expect(w.ahriRushes[0].bursts[0].origin).toEqual({ x: 0, y: 0 });
  expect(w.ahriRushes[0].bursts[0].bolts).toEqual([]);
});

test('human control and a committed basic windup receive no W/R decisions', () => {
  for (const condition of ['human', 'windup'] as const) {
    const { w, bot, enemy, planned } = setup();
    bot.ai = false;
    if (condition === 'windup') {
      w.setOrder(bot, { type: 'attack', target: enemy.id });
      w.step();
      expect(bot.releaseTick).not.toBeNull();
      bot.ai = true;
      bot.nextThink = 0;
    }
    bot.hp = bot.maxHp * 0.2;
    w.step();
    expect(planned()).toEqual([]);
  }
});
