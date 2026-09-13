import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(visible = true) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => visible });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const enemy = w.spawn('champion', 'red', { x: 800, y: 0 });
  enemy.hp = enemy.maxHp = 10000;
  const state = w.championState(lux.id)!;
  state.cooldowns.f = state.cooldowns.d = Infinity;
  lux.ai = true;
  lux.nextThink = 0;
  const planned = () => w.commands.filter((c) => c.type === 'cast' && c.unit === lux.id);
  return { w, lux, enemy, state, planned };
}

test('Lux queues a normal binding through one blocker and uses E when two blockers intercept Q', () => {
  for (const count of [1, 2]) {
    const { w, lux, state, planned } = setup();
    for (let i = 0; i < count; i++) w.spawn('melee', 'red', { x: 200 + i * 250, y: 0 });
    w.step();
    expect(planned()).toEqual([
      { type: 'cast', unit: lux.id, ability: count === 1 ? 'q' : 'e', point: { x: 800, y: 0 } },
    ]);
    w.step();
    expect(state.pendingCast!.ability).toBe(count === 1 ? 'q' : 'e');
    expect(lux.mana).toBeLessThan(lux.maxMana);
  }
});

test('a threatened injured ally receives a queued shield instead of an offensive Volley', () => {
  const { w, lux, planned, state } = setup();
  const ally = w.spawn('champion', 'blue', { x: 250, y: 0 });
  ally.hp = ally.maxHp * 0.4;
  w.step();
  expect(planned()).toEqual([
    { type: 'cast', unit: lux.id, ability: 'w', point: { x: 250, y: 0 } },
  ]);
  w.step(30);
  expect(state.cooldowns.w).toBeGreaterThan(w.tick);
  expect(w.shieldAmount(ally)).toBeGreaterThan(0);
  expect(w.projectiles.some((p) => p.source === lux.id && p.type === 'volley')).toBe(false);
});

test('Lux detonates an armed zone on a visible champion at zero mana, and resumes across save/load', () => {
  const { w, lux, enemy, planned } = setup();
  lux.ai = false;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: enemy });
  w.step(60);
  lux.ai = true;
  lux.nextThink = 0;
  lux.mana = 0;
  w.step();
  expect(planned()).toEqual([
    { type: 'cast', unit: lux.id, ability: 'e', point: { x: 800, y: 0 } },
  ]);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(40);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
});

test('R finish estimate includes magic resistance and shield capacity', () => {
  for (const shielded of [false, true]) {
    const { w, enemy, state, planned } = setup();
    state.spellRanks.q = state.spellRanks.w = state.spellRanks.e = 0;
    enemy.hp = 150;
    enemy.magicResist = 100;
    if (shielded) w.applyShield(enemy, enemy, 100, 150);
    w.step();
    // 300 raw becomes 150 after resistance; the same-tick regen occurs after planning.
    expect(planned().some((c) => c.type === 'cast' && c.ability === 'r')).toBe(!shielded);
  }
});

test('hidden enemy positions and low health do not produce Lux combat casts', () => {
  for (const x of [200, 800, 2500]) {
    const { w, enemy, planned } = setup(false);
    enemy.x = x;
    enemy.hp = 1;
    w.step();
    expect(planned()).toEqual([]);
  }
});

test('retreating Lux can shield herself without requiring a nonzero ally position', () => {
  const { w, lux, planned } = setup();
  lux.hp = lux.maxHp * 0.2;
  w.step();
  expect(planned()).toEqual([
    { type: 'cast', unit: lux.id, ability: 'w', point: { x: 800, y: 0 } },
  ]);
  w.step();
  expect(w.shieldAmount(lux)).toBeGreaterThan(0);
});

test('Lux allocates E-first ranks without Hawkshot charges and buys an available AP component', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, id: 'rift', initialUnits: [] });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', w.battlefield.spawns.blue, 'lux');
  lux.ai = true;
  lux.nextThink = 0;
  const state = w.championState(lux.id)!;
  w.gainExperience(2400, lux.id);
  w.step();
  expect(state.spellRanks).toEqual({ q: 1, w: 1, e: 3, r: 1 });
  expect(state.eCharges).toBe(0);
  expect(state.inventory).toContain('tome');
  expect(state.inventory).not.toContain('blade');
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
