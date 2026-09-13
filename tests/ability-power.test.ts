import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { DT, ITEMS } from '../src/content/rules';
import { ASHE } from '../src/content/ashe-progression';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('Amplifying Tome matches pinned source stats and prices', () => {
  const source = JSON.parse(readFileSync('docs/reference/amplifying-tome.json', 'utf8')).item;
  const item = ITEMS.find((item) => item.id === 'tome')!;
  expect(item.abilityPower).toBe(source.stats.FlatMagicDamageMod);
  expect(item.price).toBe(source.gold.total);
  expect(item.sell).toBe(source.gold.sell);
});
for (const team of ['blue', 'red'] as const)
  test(`${team} AP stacks independently and R keeps its cast snapshot after sale`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const owner = w.spawn('champion', team, w.battlefield.spawns[team]);
    w.championState(owner.id)!.gold = 800;
    expect(w.buy('tome', owner.id)).toBeNull();
    expect(w.buy('tome', owner.id)).toBeNull();
    expect(w.abilityPower(owner)).toBe(40);
    expect(w.abilityPower()).toBe(0);
    expect(w.volleyDamage(owner)).toBe(60);
    w.enqueue({
      type: 'cast',
      unit: owner.id,
      ability: 'r',
      point: { x: owner.x + 1000, y: owner.y },
    });
    w.step();
    expect(w.championState(owner.id)!.pendingCast!.damage).toBe(248);
    expect(w.sell(0, owner.id)).toBeNull();
    expect(w.crystalArrowDamage(owner)).toBe(224);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(15);
      expect(world.projectiles.find((p) => p.source === owner.id)!.damage).toBe(248);
      expect(world.sell(1, owner.id)).toBeNull();
      expect(world.abilityPower(world.unit(owner.id)!)).toBe(0);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });

for (const team of ['blue', 'red'] as const)
  test(`${team} AP-scaled R impact preserves captured damage through resistance, splash and restore`, () => {
    const w = new World(false, {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => true,
      findPath: (_from, to) => [{ x: to.x, y: to.y }],
      reachable: (p) => ({ x: p.x, y: p.y }),
      lineWalkable: () => true,
    });
    w.nextWaveTick = Infinity;
    const owner = w.spawn('champion', team, w.battlefield.spawns[team]);
    w.championState(owner.id)!.gold = 800;
    expect(w.buy('tome', owner.id)).toBeNull();
    expect(w.buy('tome', owner.id)).toBeNull();
    const enemy = team === 'blue' ? 'red' : 'blue';
    const primary = w.spawn('champion', enemy, { x: owner.x + 700, y: owner.y });
    const splash = w.spawn('melee', enemy, { x: primary.x, y: primary.y + 150 });
    const outside = w.spawn('melee', enemy, { x: primary.x, y: primary.y + 500 });
    for (const unit of [owner, primary, splash, outside]) unit.ai = false;
    primary.hp = primary.maxHp = splash.hp = splash.maxHp = 1000;
    primary.magicResist = 100;
    splash.magicResist = 50;
    w.enqueue({ type: 'cast', unit: owner.id, ability: 'r', point: primary });
    w.step(17);
    expect(w.projectiles.find((p) => p.source === owner.id)!.damage).toBe(248);
    expect(w.sell(1, owner.id)).toBeNull();
    expect(w.sell(0, owner.id)).toBeNull();
    expect(w.crystalArrowDamage(owner)).toBe(200);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      const target = world.unit(primary.id)!;
      for (let tick = 0; tick < 90 && target.hp === target.maxHp; tick++) world.step();
      // Champion regeneration runs after impact in the same simulation tick.
      expect(target.maxHp - target.hp + ASHE.healthRegen * DT).toBeCloseTo(124);
      expect(1000 - world.unit(splash.id)!.hp).toBeCloseTo(248 / 1.5);
      expect(world.unit(outside.id)!.hp).toBe(outside.maxHp);
      expect(world.projectiles.some((p) => p.source === owner.id)).toBe(false);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
