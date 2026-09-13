import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const healer = w.spawn('champion', team, { x: 0, y: 0 });
  const ally = w.spawn('champion', team, { x: 100, y: 0 });
  const victim = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 200, y: 0 });
  ally.hp = 100;
  w.enqueue({ type: 'cast', unit: healer.id, ability: 'f', point: ally });
  w.step();
  return { w, healer, ally, victim };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} Heal supporter gets one assist and distant XP, with saved continuation`, () => {
    const { w, healer, ally, victim } = setup(team);
    expect(ally.hp).toBeGreaterThan(100);
    healer.x = healer.y = -6000;
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) {
      world.damage(world.unit(ally.id)!, world.unit(victim.id)!, 10000, 'true');
      expect(world.championState(healer.id)!.assists).toBe(1);
      expect(world.championState(healer.id)!.xp).toBeCloseTo(13.986);
      expect(world.championState(ally.id)!.kills).toBe(1);
      expect(world.championState(ally.id)!.assists).toBe(0);
      expect(world.championState(healer.id)!.gold).toBe(500);
    }
    expect(saved.snapshot()).toBe(w.snapshot());
  });
}

test('support credit expires at its own window and survives the supporter dying', () => {
  for (const elapsed of [900, 901]) {
    const { w, healer, ally, victim } = setup();
    const supportedAt = w.tick;
    healer.hp = 0;
    healer.deadAt = supportedAt;
    healer.respawnTick = supportedAt + 2000;
    healer.x = -6000;
    w.tick += elapsed;
    w.damage(ally, victim, 10000, 'true');
    expect(w.championState(healer.id)!.assists).toBe(elapsed === 900 ? 1 : 0);
    expect(w.championState(healer.id)!.xp).toBeCloseTo(elapsed === 900 ? 13.986 : 0);
    expect(healer.hp).toBe(0);
  }
});

test('supporting a damage assistant counts and deduplicates damage, reveal and repeated Heal', () => {
  const { w, healer, ally, victim } = setup();
  const killer = w.spawn('champion', 'blue', { x: 300, y: 0 });
  w.damage(ally, victim, 1, 'true');
  w.damage(healer, victim, 1, 'true');
  w.championState(victim.id)!.revealContributors.push({
    sourceId: healer.id,
    lastRevealTick: w.tick,
  });
  w.championState(healer.id)!.cooldowns.f = 0;
  w.enqueue({ type: 'cast', unit: healer.id, ability: 'f', point: ally });
  w.step();
  expect(w.championState(ally.id)!.supportContributors).toEqual([
    { sourceId: healer.id, lastSupportTick: w.tick },
  ]);
  w.damage(killer, victim, 10000, 'true');
  expect(w.championState(healer.id)!.assists).toBe(1);
  expect(w.championState(ally.id)!.assists).toBe(1);
  expect(w.championState(healer.id)!.xp).toBeCloseTo(9.324);
});

test('proximity XP alone does not create support assists and support does not recurse', () => {
  const { w, healer, ally, victim } = setup();
  const killer = w.spawn('champion', 'blue', { x: 300, y: 0 });
  w.championState(healer.id)!.cooldowns.f = 0;
  w.enqueue({ type: 'cast', unit: ally.id, ability: 'f', point: killer });
  w.step();
  w.damage(killer, victim, 10000, 'true');
  expect(w.championState(ally.id)!.assists).toBe(1);
  expect(w.championState(healer.id)!.assists).toBe(0);
  expect(w.championState(healer.id)!.xp).toBeGreaterThan(0);
});

test('Heal haste at full health counts; rejected Heal cannot refresh and execution keeps killer excluded', () => {
  const { w, healer, ally, victim } = setup();
  w.championState(healer.id)!.cooldowns.f = 0;
  ally.hp = ally.maxHp;
  w.enqueue({ type: 'cast', unit: healer.id, ability: 'f', point: ally });
  w.step();
  const supportedAt = w.tick;
  w.enqueue({ type: 'cast', unit: healer.id, ability: 'f', point: ally });
  w.step();
  expect(w.championState(ally.id)!.supportContributors[0].lastSupportTick).toBe(supportedAt);
  w.damage(ally, victim, 1, 'true');
  w.damage(w.spawn('melee', 'blue', victim), victim, 10000, 'true');
  expect(w.championState(healer.id)!.assists).toBe(1);
  expect(w.championState(ally.id)!.kills).toBe(1);
  expect(w.championState(ally.id)!.assists).toBe(0);
});

test('support snapshot rejects invalid source, team, self, duplicate and future timestamps', () => {
  const { w, healer, ally, victim } = setup();
  for (const entries of [
    [{ sourceId: 999999, lastSupportTick: 0 }],
    [{ sourceId: victim.id, lastSupportTick: 0 }],
    [{ sourceId: ally.id, lastSupportTick: 0 }],
    [{ sourceId: healer.id, lastSupportTick: 2 }],
    [
      { sourceId: healer.id, lastSupportTick: 0 },
      { sourceId: healer.id, lastSupportTick: 1 },
    ],
  ]) {
    const saved = JSON.parse(w.snapshot());
    saved.otherChampions.find((state: { id: number }) => state.id === ally.id).supportContributors =
      entries;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow(
      /support contributions/
    );
  }
});

test('respawning the supported ally clears support from the previous life', () => {
  const { w, healer, ally, victim } = setup();
  w.damage(victim, ally, 10000, 'true');
  expect(w.championState(ally.id)!.supportContributors).toHaveLength(1);
  ally.respawnTick = w.tick + 1;
  w.step();
  expect(ally.hp).toBeGreaterThan(0);
  expect(w.championState(ally.id)!.supportContributors).toEqual([]);
  w.damage(ally, victim, 10000, 'true');
  expect(w.championState(healer.id)!.assists).toBe(0);
});
