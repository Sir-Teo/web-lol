import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'blue', learned = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona'),
    enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 1000, y: 0 }, 'lux'),
    state = w.championState(leona.id)!;
  leona.ai = enemy.ai = false;
  leona.speed = 0;
  enemy.damage = enemy.magicResist = 0;
  w.gainExperience(2400, leona.id);
  for (const key of ['q', 'e', 'w', 'w', 'w', learned ? 'r' : 'q'] as const)
    expect(w.learnSpell(key, leona.id)).toBeNull();
  state.cooldowns.d = state.cooldowns.f = Infinity;
  w.applyRoot(enemy, 90);
  const think = () => {
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
  };
  const queued = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === leona.id && c.ability === 'r');
  const group = () => {
    enemy.x = 600;
    const outer = w.spawn('champion', enemy.team, { x: 600, y: 250 }, 'lux');
    outer.ai = false;
    outer.damage = outer.magicResist = 0;
    w.applyRoot(outer, 90);
    return outer;
  };
  return { w, leona, enemy, state, think, queued, group };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Leona follows a held group through paid R damage, center stun, outer slow and saved futures`, () => {
    const f = setup(team),
      outer = f.group(),
      hp = [f.enemy.hp, outer.hp];
    f.think();
    expect(f.queued()).toEqual([
      { type: 'cast', unit: f.leona.id, ability: 'r', point: { x: 600, y: 0 } },
    ]);
    expect(f.w.commands.some((c) => c.type === 'cast' && c.ability === 'e')).toBe(false);
    const saved = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step();
    saved.step();
    expect(f.state.leonaR).not.toBeNull();
    expect(f.leona.mana).toBeLessThan(f.leona.maxMana - 99);
    expect(f.state.cooldowns.r).toBeGreaterThan(f.w.tick);
    f.w.step(16);
    saved.step(16);
    expect(f.state.leonaR?.released).toBe(true);
    expect(f.enemy.hp).toBe(hp[0]);
    const released = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    for (const world of [f.w, saved, released]) world.step(30);
    expect(saved.snapshot()).toBe(f.w.snapshot());
    expect(released.snapshot()).toBe(f.w.snapshot());
    expect(f.state.leonaR).toBeNull();
    expect(f.enemy.hp).toBeLessThan(hp[0] - 149);
    expect(outer.hp).toBeLessThan(hp[1] - 149);
    expect(f.enemy.stunUntil).toBeGreaterThan(f.w.tick);
    expect(outer.stunUntil).toBe(0);
    expect(outer.slows.some((s) => s.kind === 'solar-flare')).toBe(true);
    expect(f.enemy.sunlight?.sourceId).toBe(f.leona.id);
    expect(outer.sunlight?.sourceId).toBe(f.leona.id);
  });

test('a held ranged finisher accounts for actual magic resistance and shields', () => {
  for (const condition of ['finish', 'resistance', 'shield', 'healthy', 'melee']) {
    const f = setup();
    f.enemy.hp = 100;
    if (condition === 'resistance') f.enemy.magicResist = 100;
    if (condition === 'shield') f.w.applyShield(f.enemy, f.enemy, 100, 180);
    if (condition === 'healthy') f.enemy.hp = f.enemy.maxHp;
    if (condition === 'melee') f.enemy.x = 100;
    f.think();
    expect(f.queued(), condition).toHaveLength(condition === 'finish' ? 1 : 0);
    if (condition === 'finish') {
      f.w.step(42);
      expect(f.enemy.hp).toBe(0);
    }
  }
});

test('R rejects hidden/mobile/briefly held/out-of-range targets and unavailable or retreating actors', () => {
  for (const condition of [
    'hidden',
    'mobile',
    'short',
    'range',
    'mana',
    'unlearned',
    'silence',
    'stun',
    'cooldown',
    'retreat',
  ]) {
    const f = setup('blue', condition !== 'unlearned');
    f.enemy.hp = 100;
    if (condition === 'hidden') f.w.battlefield.lineOfSight = () => false;
    if (condition === 'mobile') f.enemy.rootUntil = 0;
    if (condition === 'short') f.enemy.rootUntil = 20;
    if (condition === 'range') f.enemy.x = 1300;
    if (condition === 'mana') f.leona.mana = 99;
    if (condition === 'silence') f.leona.silenceUntil = 1000;
    if (condition === 'stun') f.leona.stunUntil = 1000;
    if (condition === 'cooldown') f.state.cooldowns.r = 1000;
    if (condition === 'retreat') f.leona.hp = f.leona.maxHp * 0.2;
    f.think();
    expect(f.queued(), condition).toHaveLength(0);
    expect(f.state.leonaR, condition).toBeNull();
  }
});

test('hidden, mobile or separated extra champions cannot qualify a group cast', () => {
  for (const condition of ['hidden', 'mobile', 'far']) {
    const f = setup(),
      other = f.group();
    if (condition === 'hidden') f.w.battlefield.lineOfSight = (_a, b) => b.y < 100;
    if (condition === 'mobile') other.rootUntil = 0;
    if (condition === 'far') other.y = 400;
    f.think();
    expect(f.queued(), condition).toHaveLength(0);
  }
});

test('ordinary E keeps priority for an isolated catch before R considers a finisher', () => {
  const f = setup();
  f.enemy.x = 600;
  f.enemy.hp = 100;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.w.commands.some((c) => c.type === 'cast' && c.ability === 'e')).toBe(true);
});

test('R preserves a committed melee windup while a held ranged finisher is available', () => {
  const f = setup(),
    minion = f.w.spawn('melee', 'red', { x: 150, y: 0 });
  minion.ai = false;
  f.enemy.hp = 100;
  f.w.setOrder(f.leona, { type: 'attack', target: minion.id });
  f.w.step();
  const release = f.leona.releaseTick;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.leona.releaseTick).toBe(release);
});

test('root permits the ordinary R point cast without allowing an E dash', () => {
  const f = setup();
  f.enemy.hp = 100;
  f.w.applyRoot(f.leona, 90);
  f.think();
  expect(f.queued()).toHaveLength(1);
  f.w.step();
  expect(f.state.leonaR).not.toBeNull();
  expect(f.leona.rootUntil).toBeGreaterThan(f.w.tick);
});

for (const mana of [150, 200])
  test(`defensive W reserves mana before R at ${mana} mana with exact combined futures`, () => {
    const f = setup();
    f.group();
    f.leona.mana = mana;
    f.enemy.range = 700;
    f.w.setOrder(f.enemy, { type: 'attack', target: f.leona.id });
    f.w.step();
    f.think();
    expect(f.w.commands.some((c) => c.type === 'cast' && c.ability === 'w')).toBe(true);
    expect(f.queued()).toHaveLength(mana === 150 ? 0 : 1);
    f.w.step();
    expect(f.state.leonaW).not.toBeNull();
    expect(f.state.leonaR !== null).toBe(mana === 200);
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step(75);
    copy.step(75);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  });

test('R keeps its copied observed point after a target is hidden and displaced', () => {
  const f = setup();
  f.enemy.hp = 100;
  f.think();
  expect(f.queued()).toHaveLength(1);
  f.enemy.y = 500;
  f.w.battlefield.lineOfSight = () => false;
  f.w.step();
  expect(f.leona.mana).toBeLessThan(f.leona.maxMana - 99);
  f.w.step(41);
  expect(f.enemy.hp).toBeGreaterThan(100);
  expect(f.enemy.sunlight).toBeNull();
  expect(f.state.leonaRVisuals.at(-1)?.point).toEqual({ x: 1000, y: 0 });
});

test('accepting R holds a moving caster at the evaluated dispatch origin', () => {
  const f = setup();
  f.enemy.hp = 100;
  f.leona.speed = 335;
  f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
  f.think();
  expect(f.queued()).toHaveLength(1);
  expect({ x: f.leona.x, y: f.leona.y }).toEqual({ x: 0, y: 0 });
  f.w.step();
  expect(f.state.leonaR?.origin).toEqual({ x: 0, y: 0 });
});

test('own outward E or released R cannot be duplicated by clearing its cooldown', () => {
  for (const ability of ['e', 'r'] as const) {
    const f = setup();
    f.group();
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability, point: f.enemy });
    f.w.step(16);
    if (ability === 'e') expect(f.w.projectiles.some((p) => p.type === 'zenith')).toBe(true);
    else expect(f.state.leonaR?.released).toBe(true);
    f.state.cooldowns.r = 0;
    f.think();
    expect(f.queued()).toHaveLength(0);
  }
});

test('visible turret danger retains the existing escape path ahead of an R group opportunity', () => {
  const f = setup();
  f.group();
  f.w.spawn('turret', 'red', { x: 100, y: 0 });
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.leona.order.type).toBe('move');
});

test('a dead champion with a retained control clock cannot qualify as a group member or finisher', () => {
  for (const group of [false, true]) {
    const f = setup();
    const victim = group ? f.group() : f.enemy;
    f.enemy.x = victim.x = 1000;
    f.w.damage(f.w.hero, victim, 100000, 'true');
    expect(victim.hp).toBe(0);
    expect(victim.rootUntil).toBeGreaterThan(40);
    f.think();
    expect(f.queued()).toHaveLength(0);
  }
});
