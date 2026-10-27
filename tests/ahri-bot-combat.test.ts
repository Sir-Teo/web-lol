import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';

function setup(
  level = 2,
  team: 'blue' | 'red' = 'blue',
  targetChampion: 'ashe' | 'masteryi' = 'ashe'
) {
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
  const enemy = w.spawn(
    'champion',
    team === 'blue' ? 'red' : 'blue',
    { x: 800, y: 0 },
    targetChampion
  );
  enemy.hp = enemy.maxHp = 10000;
  enemy.ai = false;
  const state = w.championState(bot.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  bot.ai = true;
  bot.nextThink = 0;
  if (level === 2) w.gainExperience(280, bot.id);
  const planned = () => w.commands.filter((c) => c.type === 'cast' && c.unit === bot.id);
  return { w, bot, enemy, state, planned };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Ahri learns and queues real Charm, applies control and restores its exact future`, () => {
    const { w, bot, enemy, state, planned } = setup(2, team);
    w.step();
    expect(state.spellRanks).toEqual({ q: 1, w: 0, e: 1, r: 0 });
    expect(planned()).toEqual([
      { type: 'cast', unit: bot.id, ability: 'e', point: { x: 800, y: 0 } },
    ]);
    const queued = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step();
    queued.step();
    expect(queued.snapshot()).toBe(w.snapshot());
    expect(state.pendingCast).toMatchObject({ ability: 'e', rank: 1, damage: 80 });
    const windup = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (let i = 0; i < 100 && !enemy.charm; i++) {
      w.step();
      windup.step();
      expect(windup.snapshot()).toBe(w.snapshot());
    }
    expect(enemy.charm).toMatchObject({ sourceId: bot.id, rank: 1 });
    const casterAtImpact = { x: bot.x, y: bot.y };
    const impactDistance = distance(casterAtImpact, enemy);
    const impact = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step();
    impact.step();
    expect(impact.snapshot()).toBe(w.snapshot());
    expect(enemy.order.type).toBe('move');
    expect(distance(casterAtImpact, enemy)).toBeLessThan(impactDistance);
    w.step(120);
    impact.step(120);
    expect(impact.snapshot()).toBe(w.snapshot());
  });

test('level-one Q goes through minions and records both real orb legs without manual learning', () => {
  const { w, bot, enemy, state, planned } = setup(1);
  const blocker = w.spawn('melee', 'red', { x: 300, y: 0 });
  blocker.ai = false;
  w.step();
  expect(state.spellRanks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
  expect(planned()).toEqual([
    { type: 'cast', unit: bot.id, ability: 'q', point: { x: 800, y: 0 } },
  ]);
  const outward = new Set<number>(),
    returning = new Set<number>();
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 180; i++) {
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
    for (const orb of w.ahriOrbs) {
      orb.outwardHits.forEach((id) => outward.add(id));
      orb.returnHits.forEach((id) => returning.add(id));
    }
  }
  expect(outward.has(enemy.id)).toBe(true);
  expect(returning.has(enemy.id)).toBe(true);
});

test('an observed first-hit blocker switches Charm to the piercing Q cast', () => {
  const { w, bot, planned } = setup();
  const blocker = w.spawn('melee', 'red', { x: 300, y: 0 });
  blocker.ai = false;
  w.step();
  expect(planned()).toEqual([
    { type: 'cast', unit: bot.id, ability: 'q', point: { x: 800, y: 0 } },
  ]);
});

test('hidden blockers cannot change a casting decision but still intercept the actual missile', () => {
  for (const x of [300, 400]) {
    const { w, bot, enemy, planned } = setup();
    const blocker = w.spawn('melee', 'red', { x, y: 0 });
    blocker.ai = false;
    blocker.hp = blocker.maxHp = 1000;
    w.battlefield.lineOfSight = (_from, to) => to.x !== x;
    expect(w.visible(blocker, 'blue')).toBe(false);
    expect(w.visible(enemy, 'blue')).toBe(true);
    w.step();
    expect(planned()).toEqual([
      { type: 'cast', unit: bot.id, ability: 'e', point: { x: 800, y: 0 } },
    ]);
    for (let i = 0; i < 60 && !blocker.charm; i++) w.step();
    expect(blocker.charm).toMatchObject({ sourceId: bot.id });
    expect(enemy.charm).toBeNull();
  }
});

test('hidden enemy position and health do not produce a spell cast', () => {
  for (const x of [200, 800, 2500]) {
    const { w, enemy, planned } = setup();
    w.battlefield.lineOfSight = () => false;
    enemy.x = x;
    enemy.hp = 1;
    w.step();
    expect(planned()).toEqual([]);
  }
});

test('a queued aim remains the copied observation when the target moves out of sight', () => {
  const { w, enemy, state, planned } = setup();
  w.step();
  const aim = planned()[0];
  enemy.x = 1400;
  enemy.y = 500;
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(aim).toMatchObject({ ability: 'e', point: { x: 800, y: 0 } });
  expect(state.pendingCast).toMatchObject({ ability: 'e', point: { x: 800, y: 0 } });
});

test('silence, insufficient mana and unavailable spells prevent Q/E planning', () => {
  for (const condition of ['silence', 'mana', 'cooldown'] as const) {
    const { w, bot, state, planned } = setup();
    if (condition === 'silence') bot.silenceUntil = 100;
    if (condition === 'mana') bot.mana = 0;
    if (condition === 'cooldown') state.cooldowns.q = state.cooldowns.e = 100;
    w.step();
    expect(planned()).toEqual([]);
  }
});

test('spent Charm mana can fall back to an affordable Q while unlearned E remains unavailable', () => {
  for (const level of [1, 2]) {
    const { w, bot, planned } = setup(level);
    bot.mana = 55;
    w.step();
    expect(planned()).toEqual([
      { type: 'cast', unit: bot.id, ability: 'q', point: { x: 800, y: 0 } },
    ]);
  }
});

test('range uses observed centers and does not chase an out-of-range target with a cast', () => {
  for (const x of [1000, 1000.01]) {
    const { w, enemy, planned } = setup(1);
    enemy.x = x;
    w.step();
    expect(planned().length).toBe(x === 1000 ? 1 : 0);
  }
});

test('retreating Ahri can peel with Charm but never uses offensive Q as a substitute', () => {
  for (const blocked of [false, true]) {
    const { w, bot, enemy, planned } = setup();
    bot.hp = bot.maxHp * 0.2;
    enemy.x = 600;
    if (blocked) {
      const blocker = w.spawn('melee', 'red', { x: 300, y: 0 });
      blocker.ai = false;
    }
    w.step();
    expect(planned()).toEqual(
      blocked ? [] : [{ type: 'cast', unit: bot.id, ability: 'e', point: { x: 600, y: 0 } }]
    );
  }
});

test('retreating Ahri does not spend Charm against a distant observer', () => {
  const { w, bot, planned } = setup();
  bot.hp = bot.maxHp * 0.2;
  w.step();
  expect(planned()).toEqual([]);
});

test('a human-controlled Ahri receives no tactical spell command', () => {
  const { w, bot, planned } = setup();
  bot.ai = false;
  w.step(60);
  expect(planned()).toEqual([]);
  expect(w.ahriOrbs).toEqual([]);
  expect(w.projectiles.filter((p) => p.source === bot.id)).toEqual([]);
});

test('a committed basic windup completes without being replaced by Charm', () => {
  const { w, bot, enemy, state, planned } = setup();
  bot.ai = false;
  enemy.x = 400;
  w.setOrder(bot, { type: 'attack', target: enemy.id });
  w.step();
  expect(bot.releaseTick).not.toBeNull();
  const releaseTick = bot.releaseTick;
  bot.ai = true;
  bot.nextThink = 0;
  w.step();
  expect(planned()).toEqual([]);
  expect(state.pendingCast).toBeNull();
  expect(bot.releaseTick).toBe(releaseTick);
  expect(bot.attackTarget).toBe(enemy.id);
});

test('an existing spell windup remains committed with no duplicate queued cast', () => {
  const { w, bot, state, planned } = setup();
  w.step(2);
  expect(state.pendingCast?.ability).toBe('e');
  const pending = structuredClone(state.pendingCast);
  bot.nextThink = 0;
  w.step(5);
  expect(state.pendingCast).toEqual(pending);
  expect(planned()).toEqual([]);
});

test('tower danger keeps the bot from starting an offensive Q or Charm cast', () => {
  const { w, bot, planned } = setup();
  const tower = w.spawn('turret', 'red', { x: 450, y: 0 });
  tower.ai = false;
  w.step();
  expect(planned()).toEqual([]);
  expect(bot.order.type).toBe('move');
});

test('a real vanished Alpha Strike target is not selected for Q or Charm', () => {
  const { w, bot, enemy, planned } = setup(2, 'blue', 'masteryi');
  bot.ai = false;
  enemy.x = 500;
  expect(w.learnSpell('q', enemy.id)).toBeNull();
  w.enqueue({
    type: 'cast',
    unit: enemy.id,
    ability: 'q',
    targetId: bot.id,
    point: { x: bot.x, y: bot.y },
  });
  w.step();
  expect(w.targetable(enemy)).toBe(false);
  bot.ai = true;
  bot.nextThink = 0;
  w.step();
  expect(planned()).toEqual([]);
});

test('allies and structures on the line do not consume the first-hit Charm decision', () => {
  const { w, bot, planned } = setup();
  w.spawn('champion', 'blue', { x: 300, y: 0 });
  w.spawn('inhibitor', 'red', { x: 450, y: 0 });
  w.step();
  expect(planned()).toEqual([
    { type: 'cast', unit: bot.id, ability: 'e', point: { x: 800, y: 0 } },
  ]);
});
