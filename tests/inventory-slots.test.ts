import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

for (const team of ['blue', 'red'] as const)
  test(`${team} sales retain later slots and purchases fill the first hole`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const champion = w.spawn('champion', team, w.battlefield.spawns[team]);
    const owner = w.championState(champion.id)!;
    owner.gold = 10000;
    for (const id of ['sword', 'boots', 'pickaxe', 'sword', 'sword', 'sword'])
      expect(w.buy(id, champion.id)).toBeNull();
    expect(w.sell(1, champion.id)).toBeNull();
    expect(w.sell(3, champion.id)).toBeNull();
    expect(owner.inventory).toEqual(['sword', null, 'pickaxe', null, 'sword', 'sword']);
    const before = w.snapshot();
    expect(w.sell(1, champion.id)).not.toBeNull();
    expect(w.snapshot()).toBe(before);
    const restored = World.fromSnapshot(before, w.battlefield);
    for (const world of [w, restored]) {
      expect(world.buy('boots', champion.id)).toBeNull();
      expect(world.buy('blade', champion.id)).toBeNull();
      expect(world.championState(champion.id)!.inventory).toEqual([
        'sword',
        'boots',
        'pickaxe',
        'blade',
        'sword',
        'sword',
      ]);
      expect(world.buy('sword', champion.id)).toBe('Inventory is full');
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('snapshot rejects invalid item IDs and a seventh slot while preserving empty slots', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.player.inventory = [null, 'boots'];
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).player.inventory).toEqual([null, 'boots']);
  const state = JSON.parse(w.snapshot());
  state.player.inventory = [null, 'missing'];
  expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
  state.player.inventory = Array(7).fill(null);
  expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
});
