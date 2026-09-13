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

for (const ability of ['w', 'r'] as const)
  test(`${ability.toUpperCase()} projectile collisions apply the correct champion and minion healing`, () => {
    const w = new World(false, {
      ...PRACTICE_FIXTURE,
      lineOfSight: () => true,
      findPath: (_from, to) => [{ x: to.x, y: to.y }],
      reachable: (p) => ({ x: p.x, y: p.y }),
      lineWalkable: () => true,
    });
    w.nextWaveTick = Infinity;
    w.buy('blade');
    w.hero.x = w.hero.y = 0;
    w.hero.hp = 100;
    const champion = w.spawn('champion', 'red', { x: 700, y: 0 });
    const minion = w.spawn('melee', 'red', { x: 700, y: 100 });
    champion.ai = minion.ai = false;
    champion.hp = champion.maxHp = minion.hp = minion.maxHp = 1000;
    champion.armor = champion.magicResist = minion.armor = minion.magicResist = 0;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: { x: 900, y: 0 } });
    w.step(17);
    expect(w.projectiles.some((p) => p.type === (ability === 'w' ? 'volley' : 'ultimate'))).toBe(
      true
    );
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    const control = World.fromSnapshot(w.snapshot(), w.battlefield);
    // Remove only the effect; retain identical AD, max HP and regeneration for comparison.
    control.player.inventory = [];
    const startHP = w.hero.hp;
    for (const world of [w, restored, control]) world.step(90);
    const championDamage = w.events
      .filter((event) => event.type === 'damage' && event.unit === champion.id)
      .reduce((sum, event) => sum + event.value!, 0);
    const minionDamage = w.events
      .filter((event) => event.type === 'damage' && event.unit === minion.id)
      .reduce((sum, event) => sum + event.value!, 0);
    expect(championDamage).toBeGreaterThan(0);
    expect(minionDamage).toBeGreaterThan(0);
    expect(w.hero.hp - control.hero.hp).toBeCloseTo(
      championDamage * 0.025 + minionDamage * 0.025 * 0.33
    );
    expect(w.hero.hp).toBeGreaterThan(startHP);
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('selling Doran before an in-flight Volley lands removes its healing', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  w.buy('blade');
  w.hero.hp = 100;
  const target = w.spawn('champion', 'red', { x: w.hero.x + 500, y: w.hero.y });
  target.ai = false;
  target.armor = 0;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: target.x, y: target.y } });
  w.step(17);
  expect(w.projectiles.some((p) => p.type === 'volley')).toBe(true);
  expect(w.sell(0)).toBeNull();
  const healingBefore = w.events.filter((event) => event.type === 'heal').length;
  w.step(90);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(w.events.filter((event) => event.type === 'heal')).toHaveLength(healingBefore);
});
