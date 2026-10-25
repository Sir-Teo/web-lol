import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'red', learn = true) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 400, y: 0 });
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona');
  leona.speed = 0;
  if (learn) expect(w.learnSpell('w', leona.id)).toBeNull();
  const state = w.championState(leona.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  w.setOrder(enemy, { type: 'attack', target: leona.id });
  w.step();
  const think = () => {
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
  };
  const queued = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === leona.id && c.ability === 'w');
  return { w, leona, enemy, state, think, queued };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Leona protects against an observed attack through a paid, saved queued cast`, () => {
    const { w, leona, state, think, queued } = setup(team);
    think();
    expect(queued()).toEqual([
      { type: 'cast', unit: leona.id, ability: 'w', point: { x: 0, y: 0 } },
    ]);
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    const control = World.fromSnapshot(w.snapshot(), w.battlefield);
    control.commands = [];
    control.unit(leona.id)!.ai = false;
    for (const world of [w, saved, control]) world.step(40);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(state.leonaW).not.toBeNull();
    expect(state.cooldowns.w).toBeGreaterThan(w.tick);
    expect(leona.mana).toBeLessThan(leona.maxMana - 50);
    expect(leona.hp).toBeLessThan(leona.maxHp);
    expect(leona.hp - control.unit(leona.id)!.hp).toBeGreaterThan(5);
  });

test('a visible launched missile remains a threat after its attacker leaves sight', () => {
  const { w, leona, enemy, think, queued } = setup();
  w.step(enemy.releaseTick! - w.tick);
  w.setOrder(enemy, { type: 'idle' });
  enemy.x = 2500;
  const missile = w.projectiles.find((p) => p.target === leona.id)!;
  expect(missile).toBeDefined();
  expect(w.visible(enemy, leona.team)).toBe(false);
  expect(w.projectileVisible(missile, leona.team)).toBe(true);
  think();
  expect(queued()).toHaveLength(1);
});

test('a hidden launched missile cannot reveal its threat to the defensive planner', () => {
  const { w, enemy, state, think, queued } = setup();
  w.step(enemy.releaseTick! - w.tick);
  w.setOrder(enemy, { type: 'idle' });
  expect(w.projectiles.length).toBeGreaterThan(0);
  w.battlefield.lineOfSight = () => false;
  think();
  expect(queued()).toHaveLength(0);
  expect(state.leonaW).toBeNull();
});

test('a visible ranged windup remains a threat after the target leaves nominal attack range', () => {
  const { w, leona, enemy, state, think, queued } = setup();
  w.battlefield.inBrush = () => false;
  leona.x = -400;
  enemy.missileSpeed = 10000;
  expect(Math.abs(enemy.x - leona.x)).toBeGreaterThan(enemy.range + leona.radius);
  think();
  expect(queued()).toHaveLength(1);
  w.step(40);
  expect(state.leonaW).not.toBeNull();
  expect(leona.hp).toBeLessThan(leona.maxHp);
});

test('Eclipse decisions reject hidden intent, other targets, unavailable casts and distant arrivals', () => {
  for (const condition of [
    'hidden',
    'other-target',
    'silence',
    'stun',
    'cooldown',
    'mana',
    'distant',
    'unlearned',
  ]) {
    const { w, leona, enemy, state, think, queued } = setup('red', condition !== 'unlearned');
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'other-target')
      enemy.attackTarget = w.spawn('dummy', 'red', { x: 450, y: 0 }).id;
    if (condition === 'silence') leona.silenceUntil = 100;
    if (condition === 'stun') leona.stunUntil = 100;
    if (condition === 'cooldown') state.cooldowns.w = 100;
    if (condition === 'mana') leona.mana = 59;
    if (condition === 'distant') enemy.missileSpeed = 10;
    think();
    expect(queued(), condition).toHaveLength(0);
    expect(state.leonaW, condition).toBeNull();
  }
});

test('proximity alone and an already active Eclipse cannot spend another W', () => {
  const f = setup();
  f.w.setOrder(f.enemy, { type: 'idle' });
  f.think();
  expect(f.queued()).toHaveLength(0);
  f.w.setOrder(f.enemy, { type: 'attack', target: f.leona.id });
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'w', point: f.leona });
  f.w.step();
  const start = f.state.leonaW!.startTick;
  f.state.cooldowns.w = 0;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.state.leonaW!.startTick).toBe(start);
});

test('root does not prevent the ordinary defensive W cast', () => {
  const { w, leona, state, think, queued } = setup();
  leona.rootUntil = 100;
  think();
  expect(queued()).toHaveLength(1);
  w.step();
  expect(state.leonaW).not.toBeNull();
  expect(leona.rootUntil).toBe(100);
});

test('a queued defense preserves the accepted Zenith windup across save and dispatch', () => {
  const { w, leona, state, think, queued } = setup();
  w.gainExperience(280, leona.id);
  expect(w.learnSpell('e', leona.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: leona.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const windup = { ...state.leonaEWindup! };
  think();
  expect(queued()).toHaveLength(1);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step();
    expect(world.championState(leona.id)!.leonaW).not.toBeNull();
    expect(world.championState(leona.id)!.leonaEWindup).toEqual(windup);
    expect(world.championState(leona.id)!.castAnimation?.ability).toBe('e');
    world.step(45);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

for (const identity of ['garen', 'leona'] as const)
  test(`${identity} observes a committed Garen strike after displacement beyond ordinary reach`, () => {
    const w = new World(false, {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => true,
      inBrush: () => false,
    });
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -3000;
    const attacker = w.spawn('champion', 'blue', { x: 150, y: 0 }, 'garen');
    const defender = w.spawn('champion', 'red', { x: 0, y: 0 }, identity);
    defender.speed = 0;
    w.learnSpell('q', attacker.id);
    w.learnSpell('w', defender.id);
    w.setOrder(attacker, { type: 'attack', target: defender.id });
    w.enqueue({ type: 'cast', unit: attacker.id, ability: 'q', point: defender });
    w.step();
    const release = attacker.releaseTick!;
    expect(attacker.attackCycle?.garenQRank).toBe(1);
    defender.x = -300;
    attacker.stunUntil = 100;
    defender.ai = true;
    defender.nextThink = w.tick + 1;
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.unit === defender.id && c.ability === 'w')
    ).toBe(true);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, copy]) {
      world.step(release - world.tick + 1);
      const state = world.championState(defender.id)!;
      expect(identity === 'garen' ? state.garenW : state.leonaW).not.toBeNull();
      expect(world.unit(attacker.id)!.releaseTick).toBeNull();
      expect(
        world
          .championState(attacker.id)!
          .garenQVisuals.flatMap((record) => record.attacks)
          .some((attack) => attack.impact !== null)
      ).toBe(true);
    }
    expect(copy.snapshot()).toBe(w.snapshot());
  });
