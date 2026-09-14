import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = 400;
  w.hero.y = 0;
  const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  w.learnSpell('w', garen.id);
  const state = w.championState(garen.id)!;
  w.setOrder(w.hero, { type: 'attack', target: garen.id });
  w.step();
  const think = () => {
    garen.ai = true;
    garen.nextThink = w.tick + 1;
    w.step();
  };
  return { w, garen, state, think };
}

test('Garen anticipates a visible committed attack and absorbs its impact', () => {
  const { w, garen, state, think } = setup();
  think();
  expect(
    w.commands.some((c) => c.type === 'cast' && c.unit === garen.id && c.ability === 'w')
  ).toBe(true);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step();
    expect(world.championState(garen.id)!.garenW).not.toBeNull();
    world.step(35);
    const unit = world.unit(garen.id)!;
    expect(unit.hp).toBe(unit.maxHp);
    expect(world.shieldAmount(unit)).toBeLessThan(65);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(state.cooldowns.w).toBeGreaterThan(w.tick);
});

test('Garen also reacts to a visible launched missile after its source stops attacking', () => {
  const { w, garen, think } = setup();
  w.step(w.hero.releaseTick! - w.tick);
  w.setOrder(w.hero, { type: 'idle' });
  expect(w.projectiles.some((p) => p.target === garen.id)).toBe(true);
  think();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'w')).toBe(true);
});

test('W decisions reject hidden intent, attacks on others, disabled casts and distant arrivals', () => {
  for (const condition of ['hidden', 'other-target', 'silence', 'stun', 'cooldown', 'distant']) {
    const { w, garen, state, think } = setup();
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'other-target')
      w.hero.attackTarget = w.spawn('dummy', 'red', { x: 450, y: 0 }).id;
    if (condition === 'silence') garen.silenceUntil = 100;
    if (condition === 'stun') garen.stunUntil = 100;
    if (condition === 'cooldown') state.cooldowns.w = 100;
    if (condition === 'distant') w.hero.missileSpeed = 10;
    think();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.unit === garen.id && c.ability === 'w'),
      condition
    ).toBe(false);
    expect(state.garenW, condition).toBeNull();
  }
});

test('a nearby champion without a committed attack does not bait Courage', () => {
  const { w, garen, think } = setup();
  w.setOrder(w.hero, { type: 'idle' });
  think();
  expect(
    w.commands.some((c) => c.type === 'cast' && c.unit === garen.id && c.ability === 'w')
  ).toBe(false);
});
