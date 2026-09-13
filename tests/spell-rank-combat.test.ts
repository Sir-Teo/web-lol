import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { ASHE } from '../src/content/ashe-progression';
import { DT, TICK_RATE } from '../src/content/rules';

for (const team of ['blue', 'red'] as const) {
  test(`${team} ranked W/R casts spend the owner's mana and retain rank through windup`, () => {
    for (const ability of ['w', 'r'] as const) {
      const w = new World(false);
      w.nextWaveTick = Infinity;
      const owner = w.spawn('champion', team, { x: 0, y: 0 });
      const state = w.championState(owner.id)!;
      state.spellRanks[ability] = 2;
      w.enqueue({ type: 'cast', unit: owner.id, ability, point: { x: 1000, y: 0 } });
      const mana = owner.mana;
      w.step();
      expect(owner.mana).toBeCloseTo(mana - (ability === 'w' ? 70 : 100) + ASHE.manaRegen * DT);
      expect(state.cooldowns[ability] - w.tick).toBe((ability === 'w' ? 14.5 : 80) * TICK_RATE);
      expect(state.pendingCast!.rank).toBe(2);
      state.spellRanks[ability] = ability === 'w' ? 5 : 3;
      expect(w.player.spellRanks[ability]).toBe(1);
      const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
      for (const world of [w, restored]) {
        world.step(15);
        const arrows = world.projectiles.filter((p) => p.source === owner.id);
        expect(arrows).toHaveLength(ability === 'w' ? 8 : 1);
        for (const arrow of arrows) expect(arrow.damage).toBe(ability === 'w' ? 95 : 400);
      }
      expect(restored.snapshot()).toBe(w.snapshot());
    }
  });
}

test('rank-five Q changes actual attack speed and released empowered damage', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.spellRanks.q = 5;
  w.player.qStacks = 4;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  const base = TICK_RATE / w.hero.attackPeriod;
  expect(base * w.attackSpeedMultiplier(w.hero, undefined) - base).toBeCloseTo(0.658 * 0.6);
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 400, y: w.hero.y });
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let tick = 0; tick < 60 && !w.projectiles.length; tick++) w.step();
  expect(w.projectiles.find((p) => p.source === w.hero.id)!.damage).toBeCloseTo(
    w.hero.damage * 1.3
  );
});

test('Hawkshot retains a running recharge and schedules the next with the new rank', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const point = { x: w.hero.x + 1000, y: w.hero.y };
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
  w.step();
  const deadline = w.player.eRechargeTick!;
  w.player.spellRanks.e = 5;
  w.step(300);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
  w.step(16);
  expect(w.player.eCharges).toBe(0);
  expect(w.player.eRechargeTick).toBe(deadline);
  expect(w.player.eRechargeDurationTicks).toBe(90 * TICK_RATE);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(deadline - world.tick);
    expect(world.player.eCharges).toBe(1);
    expect(world.player.eRechargeTick).toBe(deadline + 50 * TICK_RATE);
    expect(world.player.eRechargeDurationTicks).toBe(50 * TICK_RATE);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('rank zero blocks casts without consuming mana or starting a cooldown', () => {
  for (const ability of ['q', 'w', 'e', 'r'] as const) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    w.player.spellRanks[ability] = 0;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability,
      point: { x: w.hero.x + 1000, y: w.hero.y },
    });
    w.step();
    expect(w.hero.mana).toBe(w.hero.maxMana);
    expect(w.player.cooldowns[ability]).toBe(0);
    expect(w.player.pendingCast).toBeNull();
    expect(w.events.some((event) => event.text === 'Learn that spell first')).toBe(true);
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  }
});

test('saved rank state rejects invalid caps and fractional ranks', () => {
  const w = new World(false);
  for (const [ability, rank] of [
    ['r', 4],
    ['q', 6],
    ['w', -1],
    ['e', 1.5],
  ] as const) {
    const saved = JSON.parse(w.snapshot());
    saved.player.spellRanks[ability] = rank;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
