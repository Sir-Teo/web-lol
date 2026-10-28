import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_W } from '../src/content/masteryi-w';
import { World } from '../src/simulation/world';

function setup(level = 3, team: 'blue' | 'red' = 'blue') {
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
  const bot = w.spawn('champion', team, { x: 0, y: 0 }, 'masteryi');
  const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 3000, y: 0 });
  enemy.ai = false;
  enemy.hp = enemy.maxHp = 10000;
  const state = w.championState(bot.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  w.gainExperience(level === 6 ? 2400 : 660, bot.id);
  bot.ai = true;
  // Learn through the real AI allocator before sampling ranked resource costs.
  bot.nextThink = Infinity;
  w.step();
  bot.nextThink = 0;
  const casts = () => w.commands.filter((c) => c.type === 'cast' && c.unit === bot.id);
  return { w, bot, enemy, state, casts };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} injured Yi uses a real affordable Meditate and restores its exact channel future`, () => {
    const { w, bot, state, casts } = setup(3, team);
    bot.hp = bot.maxHp * 0.4;
    const hp = bot.hp,
      mana = bot.mana;
    w.step();
    expect(casts()).toMatchObject([{ ability: 'w' }]);
    w.step();
    expect(state.meditate).toMatchObject({ rank: 1, stopTick: null });
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(240);
    copy.step(240);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(bot.hp).toBeGreaterThan(hp + 100);
    expect(bot.mana).toBeLessThan(mana - 40);
    expect(bot.mana).toBeGreaterThanOrEqual(w.abilityResources('q', bot.id).mana);
    expect(state.meditate?.stopReason).toBe('complete');
    expect(state.doubleStrike?.stacks).toBeGreaterThanOrEqual(3);
  });

  test(`${team} champion combat queues R, E and Q with real bonuses and saved paused clocks`, () => {
    const { w, bot, enemy, state, casts } = setup(6, team);
    enemy.x = 500;
    w.step();
    expect(casts()).toMatchObject([
      { ability: 'r' },
      { ability: 'e' },
      { ability: 'q', targetId: enemy.id },
    ]);
    w.step();
    expect(state.highlander).toMatchObject({ rank: 1, extensionCount: 0 });
    expect(state.wujuStyle).not.toBeNull();
    expect(state.alphaStrike).not.toBeNull();
    expect(w.movementSpeed(bot)).toBeGreaterThan(bot.speed);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(100);
    copy.step(100);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(state.highlander!.pausedTicks).toBeGreaterThan(0);
    expect(state.wujuStyle!.pausedTicks).toBeGreaterThan(0);
  });
}

test('visible threats interrupt AI Meditate on its ordinary decision cadence through a queued order', () => {
  const { w, bot, enemy, state } = setup();
  bot.hp = bot.maxHp * 0.4;
  w.step(2);
  const decision = bot.nextThink;
  enemy.x = 500;
  w.step(decision - w.tick);
  expect(state.meditate?.stopTick).toBeNull();
  expect(w.commands).toContainEqual({
    type: 'order',
    unit: bot.id,
    order: { type: 'move', point: w.battlefield.spawns.blue },
  });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  copy.step();
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(state.meditate?.stopReason).toBe('order');
  expect(bot.order).toEqual({ type: 'move', point: w.battlefield.spawns.blue });
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('hidden threat changes cannot startle an existing channel or change a safe heal decision', () => {
  for (const x of [100, 500, 3000]) {
    const { w, bot, enemy, state, casts } = setup();
    bot.hp = bot.maxHp * 0.4;
    enemy.x = x;
    w.battlefield.lineOfSight = () => false;
    w.step();
    expect(casts()).toMatchObject([{ ability: 'w' }]);
    w.step(20);
    expect(state.meditate?.stopTick).toBeNull();
    expect(w.commands).toEqual([]);
  }
});

test('rooted channel keeps protection until movement is possible; manual channels receive no AI interruption', () => {
  for (const manual of [false, true]) {
    const { w, bot, enemy, state } = setup();
    bot.hp = bot.maxHp * 0.4;
    w.step(2);
    if (manual) bot.ai = false;
    else bot.rootUntil = 100;
    enemy.x = 500;
    w.step(20);
    expect(state.meditate?.stopTick).toBeNull();
    expect(w.commands).toEqual([]);
    if (!manual) {
      w.step(90);
      expect(state.meditate?.stopReason).toBe('order');
    }
  }
});

test('sustain preserves full-channel and Q mana, fountain recovery, ready attacks and emergency retreat', () => {
  for (const condition of ['mana', 'fountain', 'windup', 'retreat', 'healthy'] as const) {
    const { w, bot, enemy, casts } = setup();
    bot.hp = bot.maxHp * 0.4;
    if (condition === 'mana') bot.mana = 100;
    if (condition === 'fountain') Object.assign(bot, w.battlefield.spawns.blue);
    if (condition === 'retreat') bot.hp = bot.maxHp * 0.1;
    if (condition === 'healthy') bot.hp = bot.maxHp * 0.55;
    if (condition === 'windup') {
      bot.ai = false;
      enemy.x = 100;
      w.setOrder(bot, { type: 'attack', target: enemy.id });
      w.step();
      expect(bot.releaseTick).not.toBeNull();
      bot.ai = true;
      bot.nextThink = 0;
    }
    w.step();
    expect(casts(), condition).toEqual([]);
  }
  const ready = setup();
  ready.bot.hp = ready.bot.maxHp * 0.4;
  const required = Math.ceil(
    ready.w.abilityResources('w', ready.bot.id).mana +
      ready.bot.maxMana * MASTER_YI_W.maximumManaPerSecond * MASTER_YI_W.durationSeconds +
      ready.w.abilityResources('q', ready.bot.id).mana
  );
  ready.bot.mana = required;
  ready.w.step();
  expect(ready.casts()).toMatchObject([{ ability: 'w' }]);
});

test('sustain waits through known recent damage and visible hostile units', () => {
  for (const condition of ['damage', 'minion', 'champion', 'monster'] as const) {
    const { w, bot, enemy, casts } = setup();
    bot.hp = bot.maxHp * 0.4;
    if (condition === 'damage') w.damage(enemy, bot, 10, 'true');
    if (condition === 'minion') w.spawn('caster', 'red', { x: 700, y: 0 }).ai = false;
    if (condition === 'champion') enemy.x = 1100;
    if (condition === 'monster') w.spawnMonster({ x: 500, y: 0 });
    w.step();
    expect(
      casts().some((c) => c.type === 'cast' && c.ability === 'w'),
      condition
    ).toBe(false);
  }
});

test('visible incoming shots deny sustain even after the shooter leaves ordinary threat range', () => {
  const { w, bot, enemy, casts } = setup();
  bot.ai = false;
  enemy.x = 500;
  w.setOrder(enemy, { type: 'attack', target: bot.id });
  w.step();
  w.step(enemy.releaseTick! - w.tick);
  expect(w.projectiles.some((p) => p.target === bot.id)).toBe(true);
  enemy.x = 3000;
  w.setOrder(enemy, { type: 'idle' });
  bot.hp = bot.maxHp * 0.4;
  bot.ai = true;
  bot.nextThink = 0;
  w.step();
  expect(casts()).toEqual([]);
});

test('healing above the stop threshold ends the channel with a saved ordinary idle order', () => {
  const { w, bot, state } = setup();
  bot.hp = bot.maxHp * 0.4;
  w.step(2);
  bot.hp = bot.maxHp * 0.9;
  w.step(bot.nextThink - w.tick);
  expect(w.commands).toContainEqual({ type: 'order', unit: bot.id, order: { type: 'idle' } });
  w.step();
  expect(state.meditate?.stopReason).toBe('order');
});

test('Highlander retains Q mana and does not force an unaffordable combo', () => {
  for (const enough of [false, true]) {
    const { w, bot, enemy, casts } = setup(6);
    enemy.x = 500;
    bot.mana = 100 + w.abilityResources('q', bot.id).mana - (enough ? 0 : 1);
    w.step();
    expect(casts().map((c) => c.type === 'cast' && c.ability)).toEqual(
      enough ? ['r', 'e', 'q'] : ['e', 'q']
    );
  }
});

test('retreat uses personal Highlander and preserves home movement, slow immunity and saved continuation', () => {
  const { w, bot, enemy, state, casts } = setup(6);
  enemy.x = 600;
  bot.hp = bot.maxHp * 0.2;
  bot.slowUntil = 100;
  bot.slowMultiplier = 0.5;
  w.step();
  expect(casts()).toMatchObject([{ ability: 'r' }]);
  expect(bot.order).toEqual({ type: 'move', point: w.battlefield.spawns.blue });
  w.step();
  expect(state.highlander).not.toBeNull();
  expect(w.slowFactor(bot)).toBe(1);
  expect(w.movementSpeed(bot)).toBeGreaterThan(bot.speed);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Highlander chase range uses visible centers and unavailable or hidden threats do not trigger escape', () => {
  for (const x of [900, 900.01]) {
    const { w, enemy, casts } = setup(6);
    enemy.x = x;
    w.step();
    expect(casts().some((c) => c.type === 'cast' && c.ability === 'r')).toBe(x === 900);
  }
  for (const condition of ['root', 'silence', 'mana', 'hidden'] as const) {
    const { w, bot, enemy, casts } = setup(6);
    enemy.x = 600;
    bot.hp = bot.maxHp * 0.2;
    if (condition === 'root') bot.rootUntil = 100;
    if (condition === 'silence') bot.silenceUntil = 100;
    if (condition === 'mana') bot.mana = 0;
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    w.step();
    expect(casts(), condition).toEqual([]);
  }
});
