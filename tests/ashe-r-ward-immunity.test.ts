import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { wardScaling } from '../src/content/warding-totem';

for (const team of ['blue', 'red'] as const)
  test(`${team} Crystal Arrow splash leaves enemy ward health and control state untouched`, () => {
    const world = new World(false, {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => true,
      reachable: (p) => ({ ...p }),
      findPath: (_a, b) => [{ ...b }],
      lineWalkable: () => true,
    });
    world.nextWaveTick = Infinity;
    const source =
      team === 'blue' ? world.hero : world.spawn('champion', team, world.battlefield.spawns[team]);
    source.ai = false;
    const enemy = team === 'blue' ? 'red' : 'blue';
    const primary = world.spawn('champion', enemy, { x: source.x + 550, y: source.y });
    primary.ai = false;
    primary.hp = primary.maxHp = 10000;
    const minion = world.spawn('melee', enemy, { x: primary.x, y: primary.y + 250 });
    minion.ai = false;
    minion.magicResist = 0;
    const ward = world.spawnWard({
      ownerId: primary.id,
      team: enemy,
      point: { x: primary.x, y: primary.y + 200 },
      origin: { x: primary.x, y: primary.y },
      startTick: world.tick,
      readyTick: world.tick,
      lifeTicks: wardScaling(1).lifeTicks,
    });
    const initial = structuredClone(ward);
    world.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: primary });
    world.step(16);
    const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
    for (const w of [world, restored]) {
      for (let i = 0; i < 90 && w.unit(primary.id)!.stunUntil === 0; i++) w.step();
      expect(w.unit(primary.id)!.stunUntil).toBeGreaterThan(w.tick);
      expect(w.unit(minion.id)!.hp).toBeLessThan(w.unit(minion.id)!.maxHp);
      expect(w.unit(minion.id)!.slowUntil).toBeGreaterThan(w.tick);
      expect(w.unit(ward.id)).toEqual(initial);
      expect(w.events.some((e) => e.type === 'damage' && e.unit === ward.id)).toBe(false);
      expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
    }
    expect(restored.snapshot()).toBe(world.snapshot());
  });
