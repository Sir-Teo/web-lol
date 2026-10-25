import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'blue', learned = true, begin = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona');
  const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 150, y: 0 });
  leona.ai = enemy.ai = false;
  leona.speed = 0;
  const state = w.championState(leona.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  if (learned) w.learnSpell('q', leona.id);
  else w.learnSpell('w', leona.id); // Spend the point legally so auto-learning cannot grant Q.
  if (begin) {
    w.setOrder(leona, { type: 'attack', target: enemy.id });
    w.step();
  }
  const ordinaryRelease = leona.releaseTick!;
  const recover = () => w.step(ordinaryRelease - w.tick);
  const think = () => {
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
  };
  const queued = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === leona.id && c.ability === 'q');
  return { w, leona, enemy, state, ordinaryRelease, recover, think, queued };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Leona resets recovery with paid Q, actual stun/Sunlight and identical saved futures`, () => {
    const f = setup(team);
    f.recover();
    const originalNext = f.leona.nextAttackTick,
      hp = f.enemy.hp;
    f.think();
    expect(f.queued()).toHaveLength(1);
    const restored = World.fromSnapshot(f.w.snapshot(), f.w.battlefield),
      control = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    control.commands = [];
    control.unit(f.leona.id)!.ai = false;
    for (const world of [f.w, restored, control]) world.step();
    expect(f.leona.releaseTick).toBeLessThan(originalNext);
    expect(f.leona.attackCycle?.leonaQRank).toBe(1);
    expect(f.state.cooldowns.q).toBeGreaterThan(f.w.tick);
    expect(f.leona.mana).toBeLessThan(f.leona.maxMana - 29);
    const release = f.leona.releaseTick!;
    for (const world of [f.w, restored, control]) world.step(release - world.tick);
    expect(restored.snapshot()).toBe(f.w.snapshot());
    expect(f.enemy.hp).toBeLessThan(hp - 40);
    expect(control.unit(f.enemy.id)!.hp).toBeGreaterThan(f.enemy.hp + 40);
    expect(f.enemy.stunUntil).toBe(f.w.tick + 60);
    expect(f.enemy.sunlight?.sourceId).toBe(f.leona.id);
    expect(f.state.leonaQVisuals.at(-1)?.impact?.targetId).toBe(f.enemy.id);
  });

test('a ready first swing starts normally without spending Q before recovery', () => {
  const f = setup('blue', true, false);
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.leona.releaseTick).not.toBeNull();
  expect(f.leona.attackCycle?.leonaQRank).toBeUndefined();
});

test('Q planning preserves a committed ordinary windup instead of restarting it', () => {
  const f = setup();
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.leona.releaseTick).toBe(f.ordinaryRelease);
  expect(f.leona.attackCycle?.leonaQRank).toBeUndefined();
});

test('Q recovery decisions reject hidden targets, range, resources, controls and nonchampion farming', () => {
  for (const condition of [
    'hidden',
    'range',
    'mana',
    'cooldown',
    'silence',
    'stun',
    'unlearned',
    'minion',
    'retreat',
  ]) {
    const f = setup('blue', condition !== 'unlearned');
    f.recover();
    if (condition === 'hidden') f.w.battlefield.lineOfSight = () => false;
    if (condition === 'range') f.enemy.x = 400;
    if (condition === 'mana') f.leona.mana = 29;
    if (condition === 'cooldown') f.state.cooldowns.q = 1000;
    if (condition === 'silence') f.leona.silenceUntil = 1000;
    if (condition === 'stun') f.leona.stunUntil = 1000;
    if (condition === 'retreat') f.leona.hp = f.leona.maxHp * 0.2;
    if (condition === 'minion') {
      f.enemy.hp = 0;
      f.enemy.deadAt = f.w.tick;
      const target = f.w.spawn('melee', 'red', { x: 150, y: 0 });
      target.ai = false;
      f.w.setOrder(f.leona, { type: 'attack', target: target.id });
    }
    f.think();
    expect(f.queued(), condition).toHaveLength(0);
    expect(f.state.leonaQ, condition).toBeNull();
  }
});

test('root permits the self buff and an active Q cannot be queued again', () => {
  const f = setup();
  f.recover();
  f.leona.rootUntil = 1000;
  f.think();
  expect(f.queued()).toHaveLength(1);
  f.w.step();
  const armed = f.state.leonaQ!.startTick;
  f.state.cooldowns.q = 0;
  f.leona.releaseTick = null;
  f.leona.nextAttackTick = f.w.tick + 100;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.state.leonaQ!.startTick).toBe(armed);
});

for (const mana of [75, 150])
  test(`queued defensive W reserves mana before a recovery Q at ${mana} mana`, () => {
    const f = setup();
    f.recover();
    f.w.gainExperience(280, f.leona.id);
    f.w.learnSpell('w', f.leona.id);
    f.leona.mana = mana;
    f.w.setOrder(f.enemy, { type: 'attack', target: f.leona.id });
    f.w.step();
    f.think();
    expect(
      f.w.commands.filter((c) => c.type === 'cast' && c.unit === f.leona.id && c.ability === 'w')
    ).toHaveLength(1);
    expect(f.queued()).toHaveLength(mana === 75 ? 0 : 1);
    f.w.step();
    expect(f.state.leonaW).not.toBeNull();
    expect(f.state.leonaQ !== null).toBe(mana === 150);
  });
