import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const first = w.spawn('champion', team, { x: 0, y: 0 });
  const last = w.spawn('champion', team, { x: 100, y: 0 });
  const victim = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 200, y: 0 });
  return { w, first, last, victim };
}
for (const team of ['blue', 'red'] as const)
  for (const kind of ['turret', 'melee'] as const)
    test(`${team} last champion receives kill, first blood and assists after a ${kind} final blow`, () => {
      const { w, first, last, victim } = setup(team);
      const finisher = w.spawn(kind, team, { x: 200, y: 0 });
      // The earlier-created champion hits last in the same tick: chronology must beat IDs.
      w.damage(last, victim, 1, 'true');
      w.damage(first, victim, 1, 'true');
      const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
      for (const world of [w, restored]) {
        world.damage(world.unit(finisher.id)!, world.unit(victim.id)!, 10000, 'true');
        expect(world.championState(first.id)!.kills).toBe(1);
        expect(world.championState(first.id)!.gold).toBe(900);
        expect(world.championState(first.id)!.assists).toBe(0);
        expect(world.championState(last.id)!.kills).toBe(0);
        expect(world.championState(last.id)!.assists).toBe(1);
        expect(world.firstBloodClaimed).toBe(true);
        const gold = world.events.find((event) => event.type === 'gold')!;
        expect(gold.unit).toBe(first.id);
        expect(gold.team).toBe(team);
      }
      expect(restored.snapshot()).toBe(w.snapshot());
    });

test('execution credit expires after the local inclusive fifteen-second boundary', () => {
  for (const age of [900, 901]) {
    const { w, first, victim } = setup('red');
    const finisher = w.spawn('melee', 'red', victim);
    w.damage(first, victim, 1, 'true');
    w.tick = age;
    w.damage(finisher, victim, 10000, 'true');
    expect(w.championState(first.id)!.kills).toBe(age === 900 ? 1 : 0);
    expect(w.championState(first.id)!.gold).toBe(age === 900 ? 900 : 500);
    expect(w.firstBloodClaimed).toBe(age === 900);
  }
});

test('direct champion final blow takes priority and dead prior contributors remain eligible', () => {
  const { w, first, last, victim } = setup('blue');
  w.damage(first, victim, 1, 'true');
  w.damage(last, victim, 10000, 'true');
  expect(w.championState(last.id)!.kills).toBe(1);
  expect(w.championState(first.id)!.assists).toBe(1);
  const next = w.spawn('champion', 'red', { x: 300, y: 0 });
  w.damage(first, next, 1, 'true');
  w.damage(last, first, 10000, 'true');
  const respawn = first.respawnTick;
  const finisher = w.spawn('melee', 'blue', next);
  w.damage(finisher, next, 10000, 'true');
  expect(w.championState(first.id)!.kills).toBe(1);
  expect(first.hp).toBe(0);
  expect(first.respawnTick).toBe(respawn);
});

test('an untouched execution preserves first blood and grants no champion kill gold', () => {
  const { w, first, victim } = setup('blue');
  w.damage(w.spawn('melee', 'blue', victim), victim, 10000, 'true');
  expect(w.firstBloodClaimed).toBe(false);
  expect(w.championState(first.id)!.kills).toBe(0);
  expect(w.championState(first.id)!.gold).toBe(500);
});
