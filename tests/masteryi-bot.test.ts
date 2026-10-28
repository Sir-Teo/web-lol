import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { experienceToNextLevel } from '../src/simulation/progression';
import { assignRole } from '../src/simulation/bot-jungle';
import { equipSummoners } from '../src/simulation/smite';

function setup(level = 2, team: 'blue' | 'red' = 'blue') {
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
  const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 500, y: 0 });
  enemy.ai = false;
  enemy.hp = enemy.maxHp = 10000;
  enemy.armor = 0;
  const state = w.championState(bot.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  if (level > 1) w.gainExperience(280, bot.id);
  bot.ai = true;
  bot.nextThink = 0;
  const casts = () => w.commands.filter((c) => c.type === 'cast' && c.unit === bot.id);
  return { w, bot, enemy, state, casts };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} Yi spends legal own points through level eighteen`, () => {
    const { w, bot, state } = setup(1, team);
    bot.nextThink = Infinity;
    const choices: string[] = [];
    for (let level = 1; level <= 18; level++) {
      if (level > 1) w.gainExperience(experienceToNextLevel(state.level), bot.id);
      const before = { ...state.spellRanks };
      w.step();
      for (const key of ['q', 'w', 'e', 'r'] as const)
        if (before[key] !== state.spellRanks[key]) choices.push(key);
      expect(state.skillPoints).toBe(0);
      expect(Object.values(state.spellRanks).reduce((sum, rank) => sum + rank, 0)).toBe(level);
      expect(state.eCharges).toBe(0);
    }
    expect(choices).toEqual([
      'q',
      'e',
      'w',
      'q',
      'q',
      'r',
      'q',
      'e',
      'q',
      'e',
      'r',
      'e',
      'e',
      'w',
      'w',
      'r',
      'w',
      'w',
    ]);
    expect(state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(w.player.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 1 });
  });

  test(`${team} learned E precedes a real paid Alpha Strike and preserves saved marks and future`, () => {
    const { w, bot, enemy, state, casts } = setup(2, team);
    w.step();
    expect(state.spellRanks).toEqual({ q: 1, w: 0, e: 1, r: 0 });
    expect(casts()).toEqual([
      { type: 'cast', unit: bot.id, ability: 'e', point: { x: 0, y: 0 } },
      {
        type: 'cast',
        unit: bot.id,
        ability: 'q',
        targetId: enemy.id,
        point: { x: enemy.x, y: enemy.y },
      },
    ]);
    const queued = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step();
    queued.step();
    expect(queued.snapshot()).toBe(w.snapshot());
    expect(state.wujuStyle).not.toBeNull();
    expect(state.alphaStrike).toMatchObject({ rank: 1, primaryTargetId: enemy.id });
    expect(w.targetable(bot)).toBe(false);
    expect(bot.mana).toBeLessThan(bot.maxMana - 49);
    const vanished = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (let i = 0; i < 60; i++) {
      w.step();
      vanished.step();
      expect(vanished.snapshot()).toBe(w.snapshot());
    }
    expect(state.alphaStrike?.marks).toHaveLength(4);
    expect(state.alphaStrike?.marks.every((mark) => mark.result === 'hit')).toBe(true);
    expect(state.wujuStyle!.pausedTicks).toBeGreaterThan(0);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    w.step(120);
    vanished.step(120);
    expect(vanished.snapshot()).toBe(w.snapshot());
  });
}

test('level-one Yi uses only learned Q and copies the selected target identity', () => {
  const { w, bot, enemy, state, casts } = setup(1);
  w.step();
  expect(state.spellRanks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
  expect(casts()).toEqual([
    { type: 'cast', unit: bot.id, ability: 'q', targetId: enemy.id, point: { x: 500, y: 0 } },
  ]);
});

test('hidden targets cannot trigger abilities or change the selected visible champion', () => {
  const planned: unknown[] = [];
  for (const x of [100, 500, 3000]) {
    const { w, casts } = setup();
    const hidden = w.spawn('champion', 'red', { x, y: 100 });
    hidden.ai = false;
    hidden.hp = x;
    w.battlefield.lineOfSight = (_a, b) => b.y !== 100;
    w.step();
    planned.push(casts());
  }
  expect(planned[1]).toEqual(planned[0]);
  expect(planned[2]).toEqual(planned[0]);
  const { w, casts } = setup();
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(casts()).toEqual([]);
});

test('Q range, root, mana, cooldown and control keep ordinary validation boundaries', () => {
  for (const condition of ['range', 'root', 'mana', 'cooldown', 'silence', 'stun'] as const) {
    const { w, bot, enemy, state, casts } = setup();
    if (condition === 'range') enemy.x = 600.01;
    if (condition === 'root') bot.rootUntil = 100;
    if (condition === 'mana') bot.mana = 0;
    if (condition === 'cooldown') state.cooldowns.q = 100;
    if (condition === 'silence') bot.silenceUntil = 100;
    if (condition === 'stun') bot.stunUntil = 100;
    w.step();
    expect(casts(), condition).toEqual([]);
  }
  const edge = setup(1);
  edge.enemy.x = 600;
  edge.w.step();
  expect(edge.casts()).toMatchObject([{ ability: 'q' }]);
});

test('a rooted zero-mana melee Yi can use free E without replacing a ready ordinary attack', () => {
  const { w, bot, enemy, state, casts } = setup();
  bot.rootUntil = 100;
  bot.mana = 0;
  enemy.x = 100;
  w.step();
  expect(casts()).toMatchObject([{ ability: 'e' }]);
  const release = bot.releaseTick;
  w.step();
  expect(state.wujuStyle).not.toBeNull();
  expect(state.alphaStrike).toBeNull();
  expect(bot.releaseTick).toBe(release);
  expect(state.cooldowns.q).toBe(0);
});

test('tower danger, retreat and a committed melee windup prevent offensive E/Q decisions', () => {
  for (const condition of ['tower', 'retreat', 'windup'] as const) {
    const { w, bot, enemy, casts } = setup();
    if (condition === 'tower') w.spawn('turret', 'red', { x: 1100, y: 0 }).ai = false;
    if (condition === 'retreat') bot.hp = bot.maxHp * 0.1;
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
});

test('new silence rejects both queued casts, while lost target sight independently rejects only Q', () => {
  for (const condition of ['silence', 'sight'] as const) {
    const { w, bot, state, casts } = setup();
    w.step();
    expect(casts()).toHaveLength(2);
    if (condition === 'silence') bot.silenceUntil = 100;
    else w.battlefield.lineOfSight = () => false;
    const mana = bot.mana;
    w.step();
    expect(state.alphaStrike).toBeNull();
    expect(state.wujuStyle !== null).toBe(condition === 'sight');
    expect(bot.mana).toBeGreaterThanOrEqual(mana);
    expect(state.cooldowns.q).toBe(0);
  }
});

test('only an already selected, visible eligible jungle monster enters the spell policy', () => {
  for (const ordered of [false, true]) {
    const { w, bot, enemy, state, casts } = setup();
    enemy.x = 3000;
    assignRole(state, 'jungle');
    equipSummoners(state, { d: 'smite', f: 'flash' });
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const monster = w.spawnMonster({ x: 250, y: 0 });
    if (ordered) w.setOrder(bot, { type: 'attack', target: monster.id });
    w.step();
    expect(casts().length > 0).toBe(ordered);
    if (ordered) {
      expect(casts()).toMatchObject([{ ability: 'e' }, { ability: 'q', targetId: monster.id }]);
      w.step();
      expect(state.alphaStrike?.primaryTargetId).toBe(monster.id);
      const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
      w.step(180);
      copy.step(180);
      expect(copy.snapshot()).toBe(w.snapshot());
    }
  }
});

test('manual Yi retains points and receives no bot commands, while dead AI learns without revival', () => {
  const manual = setup(1);
  manual.bot.ai = false;
  manual.w.gainExperience(1e6, manual.bot.id);
  manual.w.step();
  expect(manual.state.skillPoints).toBe(18);
  expect(manual.state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(manual.casts()).toEqual([]);
  const dead = setup(1);
  dead.w.gainExperience(1e6, dead.bot.id);
  dead.w.damage(dead.enemy, dead.bot, 100000, 'true');
  const copy = World.fromSnapshot(dead.w.snapshot(), dead.w.battlefield);
  dead.w.step();
  copy.step();
  expect(copy.snapshot()).toBe(dead.w.snapshot());
  expect(dead.bot.hp).toBe(0);
  expect(dead.state.skillPoints).toBe(0);
  expect(dead.state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
});
