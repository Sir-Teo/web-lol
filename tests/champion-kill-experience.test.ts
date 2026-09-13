import { expect, test } from 'vitest';
import { championKillExperience } from '../src/simulation/champion-kill-experience';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { CHAMPION_KILL_XP } from '../src/content/champion-kill-xp';

const position = (level: number, xp = 0) => ({ level, xp });
test('solo equal-level bounty uses every pinned normal-level value', () => {
  const rewards = [
    42, 114, 144, 174, 204, 234, 308, 392, 486, 590, 640, 690, 740, 790, 840, 890, 940, 990,
  ];
  for (let level = 1; level <= 18; level++)
    expect(championKillExperience(position(level), position(level), 1)).toBe(rewards[level - 1]);
});
test('shared rewards and decimal-level comeback policy use pre-award recipient levels', () => {
  expect(championKillExperience(position(6), position(6), 2)).toBeCloseTo((234 * 0.666) / 2);
  expect(championKillExperience(position(7), position(7), 2)).toBeCloseTo((308 * 0.82) / 2);
  expect(championKillExperience(position(9), position(9), 3)).toBeCloseTo((486 * 0.9) / 3);
  expect(championKillExperience(position(4), position(2), 1)).toBeCloseTo(174 * 1.2);
  expect(championKillExperience(position(4, 290), position(2), 1)).toBeCloseTo(174 * 1.3);
  expect(championKillExperience(position(1), position(18), 1)).toBeCloseTo(42 * 0.4);
});
function setup(team: 'blue' | 'red') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const attacker = w.spawn('champion', team, { x: 0, y: 0 });
  const victim = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 100, y: 0 });
  return { w, attacker, victim };
}
for (const team of ['blue', 'red'] as const) {
  test(`${team} killer gains source XP and nearby recipients share without duplicates`, () => {
    const { w, attacker, victim } = setup(team);
    const ally = w.spawn('champion', team, { x: 1700, y: 0 });
    w.damage(ally, victim, 1, 'true');
    w.damage(attacker, victim, 10000, 'true');
    expect(w.championState(attacker.id)!.xp).toBeCloseTo((42 * 0.666) / 2);
    expect(w.championState(ally.id)!.xp).toBeCloseTo((42 * 0.666) / 2);
    expect(w.player.xp).toBe(0);
  });
  test(`${team} nearby noncontributors and distant contributors receive distinct eligible shares`, () => {
    const { w, attacker, victim } = setup(team);
    const nearby = w.spawn('champion', team, { x: 1700, y: 0 });
    const outside = w.spawn('champion', team, { x: 1700.01, y: 0 });
    attacker.x = 5000;
    w.damage(attacker, victim, 10000, 'true');
    expect(w.championState(attacker.id)!.xp).toBeCloseTo((42 * 0.666) / 2);
    expect(w.championState(nearby.id)!.xp).toBeCloseTo((42 * 0.666) / 2);
    expect(w.championState(outside.id)!.xp).toBe(0);
  });
}
test('posthumous XP respects its boundary and never revives or reschedules a recipient', () => {
  for (const age of [600, 601]) {
    const { w, attacker, victim } = setup('red');
    const ally = w.spawn('champion', 'red', { x: 300, y: 0 });
    ally.hp = 0;
    ally.deadAt = 0;
    ally.respawnTick = 2000;
    w.tick = age;
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.damage(world.unit(attacker.id)!, world.unit(victim.id)!, 10000, 'true');
      expect(world.championState(ally.id)!.xp).toBeCloseTo(age === 600 ? (42 * 0.666) / 2 : 0);
      expect(world.unit(ally.id)!.hp).toBe(0);
      expect(world.unit(ally.id)!.respawnTick).toBe(2000);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});
test('XP reaching a level threshold grants a skill point without changing the other payout', () => {
  const { w, attacker, victim } = setup('blue');
  const ally = w.spawn('champion', 'blue', { x: 300, y: 0 });
  w.championState(attacker.id)!.xp = 270;
  const expectedAlly = (42 * CHAMPION_KILL_XP.sharedMultiplierByLevel[0]) / 2;
  w.damage(attacker, victim, 10000, 'true');
  expect(w.championState(attacker.id)!.level).toBe(2);
  expect(w.championState(attacker.id)!.skillPoints).toBe(1);
  expect(w.championState(ally.id)!.xp).toBe(expectedAlly);
});

test('mixed-level sharing uses one victim bounty before individual comeback modifiers', () => {
  expect(championKillExperience(position(9), position(6), 2)).toBeCloseTo((486 * 0.9 * 1.4) / 2);
  expect(championKillExperience(position(9), position(8), 2)).toBeCloseTo((486 * 0.9) / 2);
});

test('a distant dead contributor retains takedown XP beyond the proximity death window', () => {
  const { w, attacker, victim } = setup('blue');
  const ally = w.spawn('champion', 'blue', { x: 5000, y: 0 });
  w.damage(ally, victim, 1, 'true');
  ally.hp = 0;
  ally.deadAt = 0;
  ally.respawnTick = 2000;
  w.tick = 660;
  w.damage(attacker, victim, 10000, 'true');
  expect(w.championState(ally.id)!.xp).toBeCloseTo((42 * 0.666) / 2);
  expect(ally.hp).toBe(0);
});
