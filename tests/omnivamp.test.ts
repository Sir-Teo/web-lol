import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DORANS_BLADE_OMNIVAMP } from '../src/content/omnivamp';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('Doran omnivamp and unique group match the pinned item record', () => {
  const pin = JSON.parse(readFileSync('docs/reference/dorans-blade.json', 'utf8'));
  expect(DORANS_BLADE_OMNIVAMP).toBeCloseTo(pin.records['Items/1055'].PercentOmnivampMod);
  expect(pin.records['Items/1055'].mItemGroups).toContain('Items/ItemGroups/DoransItems');
  expect(pin.records['Items/ItemGroups/DoransItems'].mMaxGroupOwnable).toBe(1);
});

for (const team of ['blue', 'red'] as const)
  test(`${team} omnivamp uses mitigated damage and distinguishes minion area damage`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const attacker = w.spawn('champion', team, w.battlefield.spawns[team]);
    w.buy('blade', attacker.id);
    attacker.hp = 100;
    const enemyTeam = team === 'blue' ? 'red' : 'blue';
    const champion = w.spawn('champion', enemyTeam, { x: 0, y: 0 });
    champion.armor = 100;
    w.damage(attacker, champion, 200, 'physical', 'area');
    expect(attacker.hp).toBeCloseTo(102.5);
    const minion = w.spawn('melee', enemyTeam, { x: 0, y: 0 });
    w.damage(attacker, minion, 100, 'true');
    expect(attacker.hp).toBeCloseTo(105);
    w.damage(attacker, minion, 100, 'true', 'area');
    expect(attacker.hp).toBeCloseTo(105.825);
    w.championState(attacker.id)!.gold = 1000;
    expect(w.buy('blade', attacker.id)).toBe('You already own a Doran item');
    expect(w.sell(0, attacker.id)).toBeNull();
    const hp = attacker.hp;
    w.damage(attacker, champion, 50, 'true');
    expect(attacker.hp).toBe(hp);
  });

test('omnivamp preserves dead sources, clamps to missing health and survives restore', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.buy('blade');
  w.hero.hp = w.hero.maxHp - 1;
  const enemy = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(w.hero, enemy, 100, 'true');
  expect(w.hero.hp).toBe(w.hero.maxHp);
  w.damage(enemy, w.hero, 10000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.damage(world.hero, world.unit(enemy.id)!, 100, 'true');
    expect(world.hero.hp).toBe(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});
